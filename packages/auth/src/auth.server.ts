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
} from '@workspace/db/schema';
import { createAuthEmails } from './auth-emails.server';
import { isDuplicateOrganizationError, isSignInPath } from './auth-utils';
import { createBillingHelpers } from './billing.server';
import { PLANS, getPlanLimitsForPlanId } from './plans';
import type { PlanId } from './plans';
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

  // Build reverse map from Stripe price IDs to plan IDs.
  const priceToPlanMap: Record<string, PlanId> = {};
  for (const sp of stripePlans) {
    if (sp.priceId) priceToPlanMap[sp.priceId] = sp.name as PlanId;
    if (sp.annualDiscountPriceId)
      priceToPlanMap[sp.annualDiscountPriceId] = sp.name as PlanId;
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
            const DEFAULT_WORKSPACE_NAME = 'My Workspace';
            const slug = `ws-${crypto.randomUUID().slice(0, 8)}`;
            try {
              await auth.api.createOrganization({
                body: {
                  name: DEFAULT_WORKSPACE_NAME,
                  slug,
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
            // Resolve the workspace's own plan directly.
            const planId = await billing.resolveWorkspacePlanIdFromDb(
              organization.id
            );
            const limits = getPlanLimitsForPlanId(planId);
            if (limits.maxMembers === -1) return;
            const memberCount = await billing.countWorkspaceMembers(
              organization.id
            );
            if (memberCount >= limits.maxMembers) {
              throw new APIError('FORBIDDEN', {
                message: `This workspace has reached its member limit (${limits.maxMembers}). Upgrade the workspace plan to invite more members.`,
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
