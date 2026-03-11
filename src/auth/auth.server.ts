import { betterAuth } from 'better-auth/minimal';
import { APIError, createAuthMiddleware } from 'better-auth/api';
import {
  admin,
  lastLoginMethod,
  organization as organizationPlugin,
} from 'better-auth/plugins';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { tanstackStartCookies } from 'better-auth/tanstack-start';
import { stripe } from '@better-auth/stripe';
import Stripe from 'stripe';
import { and, count, eq } from 'drizzle-orm';
import { db } from '@/db';
import { member as memberTable, user as userTable } from '@/db/schema';
import {
  PERSONAL_WORKSPACE_NAME,
  PERSONAL_WORKSPACE_TYPE,
  buildPersonalWorkspaceSlug,
  isPersonalWorkspace,
} from '@/workspace/workspace';
import {
  PLANS,
  getPlanLimitsForPlanId,
  resolveUserPlanId,
} from '@/billing/plans';
import { isRecord, validateWorkspaceFields } from './auth-workspace.server';
import {
  sendChangeEmailConfirmation,
  sendInvitationEmail,
  sendResetPasswordEmail,
  sendVerificationEmail,
} from './auth-emails.server';
import {
  isDuplicateOrganizationError,
  isSignInPath,
} from './auth-hooks.server';

const stripeClient = new Stripe(process.env.STRIPE_SECRET_KEY!);

export const auth = betterAuth({
  telemetry: {
    enabled: false,
  },
  trustedOrigins: [
    // TODO: Whitlist domains.
    // Requests from origins not on this list are automatically blocked
    // https://www.better-auth.com/docs/reference/security#trusted-origins
    'http://localhost:3000',
  ],
  account: {
    accountLinking: {
      allowDifferentEmails: false,
      trustedProviders: ['google'],
    },
  },
  database: drizzleAdapter(db, {
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
      sendChangeEmailConfirmation,
    },
  },
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
    resetPasswordTokenExpiresIn: 600, // in seconds
    sendResetPassword: sendResetPasswordEmail,
  },
  emailVerification: {
    sendOnSignIn: true,
    expiresIn: 600, // in seconds
    autoSignInAfterVerification: true,
    emailAndPassword: {
      requireEmailVerification: true,
    },
    sendVerificationEmail,
  },
  socialProviders: {
    google: {
      prompt: 'select_account consent',
      accessType: 'offline',
      clientId: process.env.GOOGLE_CLIENT_ID as string,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
    },
  },
  hooks: {
    after: createAuthMiddleware(async (ctx) => {
      if (!isSignInPath(ctx.path)) return;
      const newSession = ctx.context.newSession;
      if (!newSession) return;

      await db
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
      stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET!,
      createCustomerOnSignUp: true,
      getCheckoutSessionParams: () => ({
        params: {
          automatic_tax: { enabled: true },
        },
      }),
      subscription: {
        enabled: true,
        plans: PLANS.filter((p) => p.stripePriceId !== null).map((p) => ({
          name: p.id,
          priceId: p.stripePriceId!,
        })),
        onSubscriptionComplete: async ({ subscription, plan }) => {
          console.log('[stripe] subscription complete', {
            subscriptionId: subscription.id,
            plan: subscription.plan,
            planName: plan.name,
            referenceId: subscription.referenceId,
            status: subscription.status,
            stripeSubscriptionId: subscription.stripeSubscriptionId,
          });
          await Promise.resolve();
        },
        onSubscriptionCreated: async ({ subscription, plan }) => {
          console.log('[stripe] subscription created', {
            subscriptionId: subscription.id,
            plan: subscription.plan,
            planName: plan.name,
            referenceId: subscription.referenceId,
            status: subscription.status,
            stripeSubscriptionId: subscription.stripeSubscriptionId,
          });
          await Promise.resolve();
        },
        onSubscriptionUpdate: async ({ subscription }) => {
          console.log('[stripe] subscription updated', {
            subscriptionId: subscription.id,
            plan: subscription.plan,
            referenceId: subscription.referenceId,
            status: subscription.status,
            periodEnd: subscription.periodEnd,
          });
          await Promise.resolve();
        },
        onSubscriptionCancel: async ({ subscription, cancellationDetails }) => {
          console.log('[stripe] subscription canceled', {
            subscriptionId: subscription.id,
            plan: subscription.plan,
            referenceId: subscription.referenceId,
            status: subscription.status,
            reason: cancellationDetails?.reason,
            feedback: cancellationDetails?.feedback,
          });
          await Promise.resolve();
        },
        onSubscriptionDeleted: async ({ subscription }) => {
          console.log('[stripe] subscription deleted', {
            subscriptionId: subscription.id,
            plan: subscription.plan,
            referenceId: subscription.referenceId,
            stripeSubscriptionId: subscription.stripeSubscriptionId,
          });
          await Promise.resolve();
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
      sendInvitationEmail,
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

          // Enforce workspace limit based on user's plan.
          if (user.id) {
            const subs = await auth.api.listActiveSubscriptions({
              query: { referenceId: user.id },
            });
            const planId = resolveUserPlanId(Array.from(subs));
            const limits = getPlanLimitsForPlanId(planId);

            if (limits.maxWorkspaces !== -1) {
              const [result] = await db
                .select({ count: count() })
                .from(memberTable)
                .where(
                  and(
                    eq(memberTable.userId, user.id),
                    eq(memberTable.role, 'owner'),
                  ),
                );
              // Drizzle's count() always returns a row, so result.count is safe.
              const workspaceCount = result.count;
              if (workspaceCount >= limits.maxWorkspaces) {
                throw new APIError('FORBIDDEN', {
                  message: `Your plan allows a maximum of ${limits.maxWorkspaces} workspace(s). Please upgrade to create more.`,
                });
              }
            }
          }
        },
        beforeUpdateOrganization: async ({ organization }) => {
          if (!isRecord(organization)) return;
          validateWorkspaceFields(organization, 'update');
          await Promise.resolve();
        },
        beforeDeleteOrganization: async ({ organization }) => {
          if (isPersonalWorkspace(organization)) {
            throw new APIError('BAD_REQUEST', {
              message: 'Personal workspace can not be deleted',
            });
          }
          await Promise.resolve();
        },
        beforeCreateInvitation: async ({ organization }) => {
          // Find the workspace owner to check their plan limits.
          const members = await db
            .select({ userId: memberTable.userId, role: memberTable.role })
            .from(memberTable)
            .where(eq(memberTable.organizationId, organization.id));
          const owner = members.find((m) => m.role === 'owner');
          if (!owner) return;

          const subs = await auth.api.listActiveSubscriptions({
            query: { referenceId: owner.userId },
          });
          const planId = resolveUserPlanId(Array.from(subs));
          const limits = getPlanLimitsForPlanId(planId);

          if (limits.maxMembersPerWorkspace !== -1) {
            if (members.length >= limits.maxMembersPerWorkspace) {
              throw new APIError('FORBIDDEN', {
                message: `This workspace has reached its member limit (${limits.maxMembersPerWorkspace}). The workspace owner needs to upgrade their plan.`,
              });
            }
          }
        },
      },
    }),
    admin({
      adminUserIds: [
        // Whitelist user ID as admin here.
      ],
    }),
    tanstackStartCookies(),
  ],
});
