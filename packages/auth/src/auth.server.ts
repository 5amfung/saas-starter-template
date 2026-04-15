import { apiKey } from '@better-auth/api-key';
import { stripe } from '@better-auth/stripe';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { APIError, createAuthMiddleware } from 'better-auth/api';
import { betterAuth } from 'better-auth/minimal';
import {
  admin,
  lastLoginMethod,
  organization as organizationPlugin,
} from 'better-auth/plugins';
import { tanstackStartCookies } from 'better-auth/tanstack-start';
import { eq } from 'drizzle-orm';
import Stripe from 'stripe';
import {
  subscription as subscriptionTable,
  user as userTable,
} from '@workspace/db-schema';
import { assertInviteAllowed } from '@workspace/billing';
import {
  OPERATIONS,
  buildWorkflowAttributes,
  startWorkflowSpan,
  workflowLogger,
} from '@workspace/logging/server';
import { createAuthEmails } from './auth-emails.server';
import { isDuplicateOrganizationError, isSignInPath } from './auth-utils';
import { createBillingHelpers } from './billing.server';
import { organizationAccessControl, organizationRoles } from './permissions';
import { generateSlug } from './slug';
import { PLANS } from './plans';
import type { PlanId } from './plans';
import type { EmailClient } from '@workspace/email';
import type { Database } from '@workspace/db';

const DEFAULT_WORKSPACE_NAME = 'My Workspace';
const DEFAULT_WORKSPACE_SLUG_ATTEMPTS = 3;

export interface AuthConfig {
  db: Database;
  emailClient: EmailClient;
  baseUrl: string;
  secret: string;
  cookiePrefix?: string;
  google: {
    clientId: string;
    clientSecret: string;
  };
  stripe: {
    secretKey: string;
    webhookSecret: string;
  };
  trustedOrigins?: Array<string>;
  /** Returns request headers in the current server context. Used by auth-emails to build email request context. */
  getRequestHeaders?: () => Headers;
}

/** Extract common subscription fields for structured logging. */
function buildSubscriptionLogPayload(subscription: {
  id: string;
  plan: string;
  referenceId: string;
  status: string;
  stripeSubscriptionId?: string | null;
  periodStart?: Date | null;
  periodEnd?: Date | null;
  billingInterval?: string | null;
  cancelAt?: Date | null;
  canceledAt?: Date | null;
  cancelAtPeriodEnd?: boolean | null;
  endedAt?: Date | null;
}) {
  return {
    subscriptionId: subscription.id,
    plan: subscription.plan,
    referenceId: subscription.referenceId,
    status: subscription.status,
    stripeSubscriptionId: subscription.stripeSubscriptionId,
    periodStart: subscription.periodStart,
    periodEnd: subscription.periodEnd,
    billingInterval: subscription.billingInterval,
    cancelAt: subscription.cancelAt,
    canceledAt: subscription.canceledAt,
    cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
    endedAt: subscription.endedAt,
  };
}

export function createAuth(config: AuthConfig) {
  const stripeClient = new Stripe(config.stripe.secretKey);
  const cookiePrefix =
    typeof config.cookiePrefix === 'string' && config.cookiePrefix.length > 0
      ? config.cookiePrefix
      : undefined;

  // Build Stripe plan config from PLANS — reads price IDs from process.env.
  const stripePlans = PLANS.filter((p) => p.stripeEnabled).map((p) => {
    const key = p.id.toUpperCase();
    // Enterprise uses a single STRIPE_ENTERPRISE_PRICE_ID env var.
    // Self-serve plans use STRIPE_{PLAN}_MONTHLY_PRICE_ID and STRIPE_{PLAN}_ANNUAL_PRICE_ID.
    if (p.isEnterprise) {
      return {
        name: p.id,
        priceId: process.env[`STRIPE_${key}_PRICE_ID`]!,
      };
    }
    return {
      name: p.id,
      priceId: process.env[`STRIPE_${key}_MONTHLY_PRICE_ID`]!,
      annualDiscountPriceId: process.env[`STRIPE_${key}_ANNUAL_PRICE_ID`]!,
    };
  });

  // Build reverse map from Stripe price IDs to plan IDs.
  const priceToPlanMap: Record<string, PlanId> = {};
  for (const sp of stripePlans) {
    if (sp.priceId) priceToPlanMap[sp.priceId] = sp.name;
    if (sp.annualDiscountPriceId)
      priceToPlanMap[sp.annualDiscountPriceId] = sp.name;
  }

  // Create billing helpers for limit enforcement and app-level queries.
  const billing = createBillingHelpers(
    config.db,
    config.stripe.secretKey,
    priceToPlanMap
  );

  const authEmails = createAuthEmails({
    emailClient: config.emailClient,
    getRequestHeaders: config.getRequestHeaders,
    baseUrl: config.baseUrl,
  });

  const auth = betterAuth({
    telemetry: {
      enabled: false,
    },
    ...(cookiePrefix !== undefined
      ? {
          advanced: {
            cookiePrefix,
          },
        }
      : {}),
    trustedOrigins: config.trustedOrigins ?? ['http://localhost:3000'],
    account: {
      accountLinking: {
        allowDifferentEmails: false,
        trustedProviders: ['google'],
      },
    },
    database: drizzleAdapter(config.db, {
      provider: 'pg',
    }),
    user: {
      additionalFields: {
        lastSignInAt: {
          type: 'date',
          required: false,
          input: false,
        },
      },
      changeEmail: {
        enabled: true,
        sendChangeEmailConfirmation: authEmails.sendChangeEmailConfirmation,
      },
    },
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: true,
      resetPasswordTokenExpiresIn: 600,
      sendResetPassword: authEmails.sendResetPasswordEmail,
    },
    emailVerification: {
      sendOnSignIn: true,
      expiresIn: 600,
      autoSignInAfterVerification: true,
      emailAndPassword: {
        requireEmailVerification: true,
      },
      sendVerificationEmail: authEmails.sendVerificationEmail,
    },
    socialProviders: {
      google: {
        prompt: 'select_account consent',
        accessType: 'offline',
        clientId: config.google.clientId,
        clientSecret: config.google.clientSecret,
      },
    },
    hooks: {
      after: createAuthMiddleware(async (ctx) => {
        if (!isSignInPath(ctx.path)) return;
        const newSession = ctx.context.newSession;
        if (!newSession) return;

        await startWorkflowSpan(
          {
            op: OPERATIONS.AUTH_SIGN_IN,
            name: 'Record last sign-in time',
            attributes: buildWorkflowAttributes(OPERATIONS.AUTH_SIGN_IN, {
              route: ctx.path,
              userId: newSession.user.id,
              result: 'attempt',
            }),
          },
          async () => {
            await config.db
              .update(userTable)
              .set({ lastSignInAt: new Date() })
              .where(eq(userTable.id, newSession.user.id));

            workflowLogger.info('Recorded user sign-in', {
              ...buildWorkflowAttributes(OPERATIONS.AUTH_SIGN_IN, {
                route: ctx.path,
                userId: newSession.user.id,
                result: 'success',
              }),
            });
          }
        );
      }),
    },
    databaseHooks: {
      user: {
        create: {
          after: async (user) => {
            await startWorkflowSpan(
              {
                op: OPERATIONS.WORKSPACE_CREATE,
                name: 'Create default workspace',
                attributes: buildWorkflowAttributes(
                  OPERATIONS.WORKSPACE_CREATE,
                  {
                    userId: user.id,
                    result: 'attempt',
                  }
                ),
              },
              async () => {
                let createdDefaultWorkspace = false;
                for (
                  let attempt = 1;
                  attempt <= DEFAULT_WORKSPACE_SLUG_ATTEMPTS;
                  attempt += 1
                ) {
                  const slug = generateSlug();

                  try {
                    await auth.api.createOrganization({
                      body: {
                        name: DEFAULT_WORKSPACE_NAME,
                        slug,
                        userId: user.id,
                      },
                    });
                    createdDefaultWorkspace = true;

                    workflowLogger.info('Created default workspace', {
                      ...buildWorkflowAttributes(OPERATIONS.WORKSPACE_CREATE, {
                        userId: user.id,
                        result: 'success',
                      }),
                    });
                    return;
                  } catch (error) {
                    if (!isDuplicateOrganizationError(error)) {
                      workflowLogger.error(
                        'Failed to create default workspace',
                        {
                          ...buildWorkflowAttributes(
                            OPERATIONS.WORKSPACE_CREATE,
                            {
                              userId: user.id,
                              result: 'failure',
                              failureCategory: 'auto_create_failed',
                            }
                          ),
                        }
                      );
                      console.error(error);
                      throw error;
                    }
                  }
                }

                if (!createdDefaultWorkspace) {
                  workflowLogger.error(
                    'Failed to create default workspace after exhausting duplicate slug retries',
                    {
                      ...buildWorkflowAttributes(OPERATIONS.WORKSPACE_CREATE, {
                        userId: user.id,
                        result: 'failure',
                        failureCategory: 'duplicate_slug_collision_exhausted',
                      }),
                    }
                  );
                }
              }
            );
          },
        },
      },
    },
    plugins: [
      apiKey([
        {
          configId: 'system-managed',
          references: 'organization',
        },
      ]),
      stripe({
        stripeClient,
        stripeWebhookSecret: config.stripe.webhookSecret,
        createCustomerOnSignUp: false,
        organization: { enabled: true },
        getCheckoutSessionParams: () => ({
          params: {
            automatic_tax: { enabled: true },
          },
        }),
        subscription: {
          enabled: true,
          plans: stripePlans,
          authorizeReference: async ({ user, referenceId }) => {
            // Only the workspace owner can manage subscriptions.
            const ownerId = await billing.getWorkspaceOwnerUserId(referenceId);
            return ownerId === user.id;
          },
          onSubscriptionComplete: async ({ subscription, plan }) => {
            console.log('subscription complete', {
              ...buildSubscriptionLogPayload(subscription),
              planName: plan.name,
            });
            return Promise.resolve();
          },
          onSubscriptionCreated: async ({ subscription, plan }) => {
            console.log('subscription created', {
              ...buildSubscriptionLogPayload(subscription),
              planName: plan.name,
            });
            return Promise.resolve();
          },
          onSubscriptionUpdate: async ({ subscription }) => {
            console.log(
              'subscription updated',
              buildSubscriptionLogPayload(subscription)
            );
            return Promise.resolve();
          },
          onSubscriptionCancel: async ({
            subscription,
            cancellationDetails,
          }) => {
            console.log('subscription canceled', {
              ...buildSubscriptionLogPayload(subscription),
              reason: cancellationDetails?.reason,
              feedback: cancellationDetails?.feedback,
            });
            return Promise.resolve();
          },
          onSubscriptionDeleted: async ({ subscription }) => {
            console.log(
              'subscription deleted',
              buildSubscriptionLogPayload(subscription)
            );
            return Promise.resolve();
          },
        },
      }),
      lastLoginMethod({
        storeInDatabase: true,
      }),
      organizationPlugin({
        ac: organizationAccessControl,
        roles: organizationRoles,
        allowUserToCreateOrganization: true,
        creatorRole: 'owner',
        requireEmailVerificationOnInvitation: true,
        sendInvitationEmail: authEmails.sendInvitationEmail,
        organizationHooks: {
          // Workspace creation is always free — no plan-based gating.
          beforeCreateOrganization: () => Promise.resolve(),
          beforeDeleteOrganization: async ({ organization }) => {
            // Block deletion of workspaces with active subscriptions.
            // User must cancel the subscription via Stripe Portal first.
            const subscriptions = await config.db
              .select({ status: subscriptionTable.status })
              .from(subscriptionTable)
              .where(eq(subscriptionTable.referenceId, organization.id));
            const hasActive = subscriptions.some(
              (s) => s.status === 'active' || s.status === 'trialing'
            );
            if (hasActive) {
              throw new APIError('BAD_REQUEST', {
                message:
                  'Cannot delete a workspace with an active subscription. Cancel the subscription first.',
              });
            }

            // Block deletion of the user's last workspace.
            const ownerId = await billing.getWorkspaceOwnerUserId(
              organization.id
            );
            if (!ownerId) return;
            const workspaceCount = await billing.countOwnedWorkspaces(ownerId);
            if (workspaceCount <= 1) {
              throw new APIError('BAD_REQUEST', {
                message: 'Cannot delete your last workspace.',
              });
            }
          },
          beforeCreateInvitation: async ({ organization }) => {
            await startWorkflowSpan(
              {
                op: OPERATIONS.WORKSPACE_MEMBER_INVITE,
                name: 'Validate workspace invitation entitlement',
                attributes: buildWorkflowAttributes(
                  OPERATIONS.WORKSPACE_MEMBER_INVITE,
                  {
                    workspaceId: organization.id,
                    result: 'attempt',
                  }
                ),
              },
              async () => {
                try {
                  await assertInviteAllowed({
                    db: config.db,
                    workspaceId: organization.id,
                  });

                  workflowLogger.info('Workspace invitation allowed', {
                    ...buildWorkflowAttributes(
                      OPERATIONS.WORKSPACE_MEMBER_INVITE,
                      {
                        workspaceId: organization.id,
                        result: 'success',
                      }
                    ),
                  });
                } catch (error) {
                  if (
                    typeof error === 'object' &&
                    error !== null &&
                    'code' in error &&
                    (error as { code?: string }).code === 'LIMIT_EXCEEDED'
                  ) {
                    workflowLogger.error(
                      'Workspace invitation blocked by member limit',
                      {
                        ...buildWorkflowAttributes(
                          OPERATIONS.WORKSPACE_MEMBER_INVITE,
                          {
                            workspaceId: organization.id,
                            result: 'failure',
                            failureCategory: 'member_limit_exceeded',
                          }
                        ),
                      }
                    );

                    const metadata =
                      'metadata' in error &&
                      typeof (error as { metadata?: unknown }).metadata ===
                        'object'
                        ? (
                            error as {
                              metadata?: Record<string, unknown>;
                            }
                          ).metadata
                        : undefined;
                    const limit = Number(metadata?.limit ?? 0);
                    throw new APIError('FORBIDDEN', {
                      message: `This workspace has reached its member limit (${limit}). Upgrade the workspace plan to invite more members.`,
                    });
                  }
                  workflowLogger.error(
                    'Unable to validate invitation entitlements',
                    {
                      ...buildWorkflowAttributes(
                        OPERATIONS.WORKSPACE_MEMBER_INVITE,
                        {
                          workspaceId: organization.id,
                          result: 'failure',
                          failureCategory: 'entitlement_validation_failed',
                        }
                      ),
                    }
                  );
                  throw new APIError('FORBIDDEN', {
                    message: 'Unable to validate invitation entitlements.',
                  });
                }
              }
            );
          },
        },
      }),
      admin(),
      tanstackStartCookies(),
    ],
  });

  return Object.assign(auth, { billing });
}

export type Auth = ReturnType<typeof createAuth>;
