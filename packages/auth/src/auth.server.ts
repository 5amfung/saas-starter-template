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
import { user as userTable } from '@workspace/db/schema';
import { createAuthEmails } from './auth-emails.server';
import { isDuplicateOrganizationError, isSignInPath } from './auth-utils';
import { validateWorkspaceFields } from './auth-workspace.server';
import { createBillingHelpers } from './billing.server';
import { PLANS, getPlanLimitsForPlanId } from './plans';
import {
  PERSONAL_WORKSPACE_NAME,
  PERSONAL_WORKSPACE_TYPE,
  buildPersonalWorkspaceSlug,
  isPersonalWorkspace,
  isRecord,
} from './workspace-types';
import type { EmailClient } from '@workspace/email';
import type { Database } from '@workspace/db';

export interface AuthConfig {
  db: Database;
  emailClient: EmailClient;
  baseUrl: string;
  secret: string;
  google: {
    clientId: string;
    clientSecret: string;
  };
  stripe: {
    secretKey: string;
    webhookSecret: string;
  };
  adminUserIds?: Array<string>;
  trustedOrigins?: Array<string>;
  /** Logger callback. Falls back to console.log when not provided. May return a promise for async loggers. */
  logger?: (
    level: 'debug' | 'info' | 'warn' | 'error',
    message: string,
    meta?: Record<string, unknown>
  ) => void | Promise<void>;
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
  const log = config.logger ?? console.log;
  const stripeClient = new Stripe(config.stripe.secretKey);

  // Build Stripe plan config from PLANS — reads price IDs from process.env.
  const stripePlans = PLANS.filter((p) => p.pricing !== null).map((p) => {
    const key = p.id.toUpperCase();
    return {
      name: p.id,
      priceId: process.env[`STRIPE_${key}_MONTHLY_PRICE_ID`]!,
      annualDiscountPriceId: process.env[`STRIPE_${key}_ANNUAL_PRICE_ID`]!,
    };
  });

  // Create billing helpers for limit enforcement and app-level queries.
  const billing = createBillingHelpers(config.db, config.stripe.secretKey);

  const authEmails = createAuthEmails({
    emailClient: config.emailClient,
    getRequestHeaders: config.getRequestHeaders,
    baseUrl: config.baseUrl,
  });

  const auth = betterAuth({
    telemetry: {
      enabled: false,
    },
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

        await config.db
          .update(userTable)
          .set({ lastSignInAt: new Date() })
          .where(eq(userTable.id, newSession.user.id));
      }),
    },
    databaseHooks: {
      user: {
        create: {
          after: async (user) => {
            try {
              await auth.api.createOrganization({
                body: {
                  name: PERSONAL_WORKSPACE_NAME,
                  slug: buildPersonalWorkspaceSlug(user.id),
                  workspaceType: PERSONAL_WORKSPACE_TYPE,
                  personalOwnerUserId: user.id,
                  userId: user.id,
                },
              });
            } catch (error) {
              if (!isDuplicateOrganizationError(error)) {
                console.error(error);
                throw error;
              }
            }
          },
        },
      },
    },
    plugins: [
      stripe({
        stripeClient,
        stripeWebhookSecret: config.stripe.webhookSecret,
        createCustomerOnSignUp: true,
        onCustomerCreate: async ({ stripeCustomer, user }) => {
          await log(
            'info',
            `Stripe customer ${stripeCustomer.id} created for user ${user.id} on signup`
          );
        },
        getCheckoutSessionParams: () => ({
          params: {
            automatic_tax: { enabled: true },
          },
        }),
        subscription: {
          enabled: true,
          plans: stripePlans,
          onSubscriptionComplete: async ({ subscription, plan }) => {
            await log('info', 'subscription complete', {
              ...buildSubscriptionLogPayload(subscription),
              planName: plan.name,
            });
          },
          onSubscriptionCreated: async ({ subscription, plan }) => {
            await log('info', 'subscription created', {
              ...buildSubscriptionLogPayload(subscription),
              planName: plan.name,
            });
          },
          onSubscriptionUpdate: async ({ subscription }) => {
            await log(
              'info',
              'subscription updated',
              buildSubscriptionLogPayload(subscription)
            );
          },
          onSubscriptionCancel: async ({
            subscription,
            cancellationDetails,
          }) => {
            await log('info', 'subscription canceled', {
              ...buildSubscriptionLogPayload(subscription),
              reason: cancellationDetails?.reason,
              feedback: cancellationDetails?.feedback,
            });
          },
          onSubscriptionDeleted: async ({ subscription }) => {
            await log(
              'info',
              'subscription deleted',
              buildSubscriptionLogPayload(subscription)
            );
          },
        },
      }),
      lastLoginMethod({
        storeInDatabase: true,
      }),
      organizationPlugin({
        allowUserToCreateOrganization: true,
        creatorRole: 'owner',
        requireEmailVerificationOnInvitation: true,
        sendInvitationEmail: authEmails.sendInvitationEmail,
        schema: {
          organization: {
            additionalFields: {
              workspaceType: {
                type: 'string',
                input: true,
                required: false,
              },
              personalOwnerUserId: {
                type: 'string',
                input: true,
                required: false,
              },
            },
          },
        },
        organizationHooks: {
          beforeCreateOrganization: async ({ organization, user }) => {
            if (!isRecord(organization)) return;
            validateWorkspaceFields(organization, 'create');

            // Personal workspaces are created during sign-up (before a session
            // exists), so auth.api calls would fail with 401. Skip the limit
            // check here -- the personal workspace still counts toward the
            // user's maxWorkspaces quota.
            if (isPersonalWorkspace(organization)) return;

            if (user.id) {
              const planId = await billing.resolveUserPlanIdFromDb(user.id);
              const limits = getPlanLimitsForPlanId(planId);
              if (limits.maxWorkspaces === -1) return;
              const workspaceCount = await billing.countOwnedWorkspaces(
                user.id
              );
              if (workspaceCount >= limits.maxWorkspaces) {
                throw new APIError('FORBIDDEN', {
                  message: `Your plan allows a maximum of ${limits.maxWorkspaces} workspace(s). Please upgrade to create more.`,
                });
              }
            }
          },
          // eslint-disable-next-line @typescript-eslint/require-await -- Better Auth requires Promise<void> return type.
          beforeUpdateOrganization: async ({ organization }) => {
            if (!isRecord(organization)) return;
            validateWorkspaceFields(organization, 'update');
          },
          // eslint-disable-next-line @typescript-eslint/require-await -- Better Auth requires Promise<void> return type.
          beforeDeleteOrganization: async ({ organization }) => {
            if (isPersonalWorkspace(organization)) {
              throw new APIError('BAD_REQUEST', {
                message: 'Personal workspace can not be deleted',
              });
            }
          },
          beforeCreateInvitation: async ({ organization }) => {
            const owner = await billing.getWorkspaceOwnerUserId(
              organization.id
            );
            if (!owner) return;
            const planId = await billing.resolveUserPlanIdFromDb(owner);
            const limits = getPlanLimitsForPlanId(planId);
            if (limits.maxMembersPerWorkspace === -1) return;
            const memberCount = await billing.countWorkspaceMembers(
              organization.id
            );
            if (memberCount >= limits.maxMembersPerWorkspace) {
              throw new APIError('FORBIDDEN', {
                message: `This workspace has reached its member limit (${limits.maxMembersPerWorkspace}). The workspace owner needs to upgrade their plan.`,
              });
            }
          },
        },
      }),
      admin({
        adminUserIds: config.adminUserIds ?? [],
      }),
      tanstackStartCookies(),
    ],
  });

  return Object.assign(auth, { billing });
}

export type Auth = ReturnType<typeof createAuth>;
