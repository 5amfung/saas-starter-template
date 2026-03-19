import { betterAuth } from "better-auth/minimal"
import { APIError, createAuthMiddleware } from "better-auth/api"
import {
  admin,
  lastLoginMethod,
  organization as organizationPlugin,
} from "better-auth/plugins"
import { drizzleAdapter } from "better-auth/adapters/drizzle"
import { tanstackStartCookies } from "better-auth/tanstack-start"
import { stripe } from "@better-auth/stripe"
import Stripe from "stripe"
import { eq } from "drizzle-orm"
import { user as userTable } from "@workspace/db/schema"
import type { Database } from "@workspace/db"
import type { EmailClient } from "@workspace/email"
import {
  PERSONAL_WORKSPACE_NAME,
  PERSONAL_WORKSPACE_TYPE,
  buildPersonalWorkspaceSlug,
  isPersonalWorkspace,
} from "./workspace-types"
import { isRecord, validateWorkspaceFields } from "./auth-workspace.server"
import { isDuplicateOrganizationError, isSignInPath } from "./auth-hooks.server"
import { createAuthEmails } from "./auth-emails.server"

export interface AuthConfig {
  db: Database
  emailClient: EmailClient
  baseUrl: string
  secret: string
  google: {
    clientId: string
    clientSecret: string
  }
  stripe: {
    secretKey: string
    webhookSecret: string
    proMonthlyPriceId: string
    proAnnualPriceId: string
  }
  adminUserIds?: Array<string>
  trustedOrigins?: Array<string>
  hooks?: AuthHooks
  /** Logger callback. Falls back to console.log when not provided. */
  logger?: (
    level: string,
    message: string,
    meta?: Record<string, unknown>
  ) => void
  /** Returns request headers in the current server context. Used by auth-emails to build email request context. */
  getRequestHeaders?: () => Headers
}

export interface AuthHooks {
  /** Called before creating an organization to check workspace limits. */
  beforeCreateOrganization?: (
    userId: string,
    organization: Record<string, unknown>
  ) => Promise<void>
  /** Called before creating an invitation to check member limits. */
  beforeCreateInvitation?: (organizationId: string) => Promise<void>
}

export function createAuth(config: AuthConfig) {
  const log = config.logger ?? console.log
  const stripeClient = new Stripe(config.stripe.secretKey)

  const authEmails = createAuthEmails({
    emailClient: config.emailClient,
    getRequestHeaders: config.getRequestHeaders,
    baseUrl: config.baseUrl,
  })

  const auth = betterAuth({
    telemetry: {
      enabled: false,
    },
    trustedOrigins: config.trustedOrigins ?? ["http://localhost:3000"],
    account: {
      accountLinking: {
        allowDifferentEmails: false,
        trustedProviders: ["google"],
      },
    },
    database: drizzleAdapter(config.db, {
      provider: "pg",
    }),
    user: {
      additionalFields: {
        lastSignInAt: {
          type: "date",
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
        prompt: "select_account consent",
        accessType: "offline",
        clientId: config.google.clientId,
        clientSecret: config.google.clientSecret,
      },
    },
    hooks: {
      after: createAuthMiddleware(async (ctx) => {
        if (!isSignInPath(ctx.path)) return
        const newSession = ctx.context.newSession
        if (!newSession) return

        await config.db
          .update(userTable)
          .set({ lastSignInAt: new Date() })
          .where(eq(userTable.id, newSession.user.id))
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
              })
            } catch (error) {
              if (!isDuplicateOrganizationError(error)) {
                console.error(error)
                throw error
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
          log(
            "info",
            `Strip customer ${stripeCustomer.id} created for user ${user.id} on signup`
          )
          return Promise.resolve()
        },
        getCheckoutSessionParams: () => ({
          params: {
            automatic_tax: { enabled: true },
          },
        }),
        subscription: {
          enabled: true,
          plans: [
            {
              name: "pro",
              priceId: config.stripe.proMonthlyPriceId,
              annualDiscountPriceId: config.stripe.proAnnualPriceId,
            },
          ],
          onSubscriptionComplete: async ({ subscription, plan }) => {
            log("info", "subscription complete", {
              subscriptionId: subscription.id,
              plan: subscription.plan,
              planName: plan.name,
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
            })
            await Promise.resolve()
          },
          onSubscriptionCreated: async ({ subscription, plan }) => {
            log("info", "subscription created", {
              subscriptionId: subscription.id,
              plan: subscription.plan,
              planName: plan.name,
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
            })
            await Promise.resolve()
          },
          onSubscriptionUpdate: async ({ subscription }) => {
            log("info", "subscription updated", {
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
            })
            await Promise.resolve()
          },
          onSubscriptionCancel: async ({
            subscription,
            cancellationDetails,
          }) => {
            log("info", "subscription canceled", {
              subscriptionId: subscription.id,
              plan: subscription.plan,
              referenceId: subscription.referenceId,
              status: subscription.status,
              periodStart: subscription.periodStart,
              periodEnd: subscription.periodEnd,
              billingInterval: subscription.billingInterval,
              cancelAt: subscription.cancelAt,
              canceledAt: subscription.canceledAt,
              cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
              endedAt: subscription.endedAt,
              reason: cancellationDetails?.reason,
              feedback: cancellationDetails?.feedback,
            })
            await Promise.resolve()
          },
          onSubscriptionDeleted: async ({ subscription }) => {
            log("info", "subscription deleted", {
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
            })
            await Promise.resolve()
          },
        },
      }),
      lastLoginMethod({
        storeInDatabase: true,
      }),
      organizationPlugin({
        allowUserToCreateOrganization: true,
        creatorRole: "owner",
        requireEmailVerificationOnInvitation: true,
        sendInvitationEmail: authEmails.sendInvitationEmail,
        schema: {
          organization: {
            additionalFields: {
              workspaceType: {
                type: "string",
                input: true,
                required: false,
              },
              personalOwnerUserId: {
                type: "string",
                input: true,
                required: false,
              },
            },
          },
        },
        organizationHooks: {
          beforeCreateOrganization: async ({ organization, user }) => {
            if (!isRecord(organization)) return
            validateWorkspaceFields(organization, "create")

            // Personal workspaces are created during sign-up (before a session
            // exists), so auth.api calls would fail with 401. Skip the limit
            // check here -- the personal workspace still counts toward the
            // user's maxWorkspaces quota.
            if (isPersonalWorkspace(organization)) return

            // Delegate billing limit check to app-provided hook.
            if (user.id && config.hooks?.beforeCreateOrganization) {
              await config.hooks.beforeCreateOrganization(user.id, organization)
            }
          },
          beforeUpdateOrganization: async ({ organization }) => {
            if (!isRecord(organization)) return
            validateWorkspaceFields(organization, "update")
            await Promise.resolve()
          },
          beforeDeleteOrganization: async ({ organization }) => {
            if (isPersonalWorkspace(organization)) {
              throw new APIError("BAD_REQUEST", {
                message: "Personal workspace can not be deleted",
              })
            }
            await Promise.resolve()
          },
          beforeCreateInvitation: async ({ organization }) => {
            // Delegate member limit check to app-provided hook.
            if (config.hooks?.beforeCreateInvitation) {
              await config.hooks.beforeCreateInvitation(organization.id)
            }
          },
        },
      }),
      admin({
        adminUserIds: config.adminUserIds ?? [],
      }),
      tanstackStartCookies(),
    ],
  })

  return auth
}

export type Auth = ReturnType<typeof createAuth>
