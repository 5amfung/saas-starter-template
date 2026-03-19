import { createDb } from "@workspace/db"
import { createEmailClient } from "@workspace/email"
import { createAuth } from "@workspace/auth/server"
import { createBillingService } from "@workspace/billing/server"
import { getRequestHeaders } from "@tanstack/react-start/server"
import { logger } from "@/lib/logger"

export const db = createDb(process.env.DATABASE_URL!)

export const emailClient = createEmailClient({
  apiKey: process.env.RESEND_API_KEY!,
  fromEmail: process.env.RESEND_FROM_EMAIL!,
  replyToEmail: process.env.RESEND_REPLY_TO_EMAIL,
  appName: process.env.VITE_APP_NAME || "App",
  devPrefix: process.env.NODE_ENV !== "production",
})

// Billing service must be created before auth since auth hooks use it.
// It only depends on db and Stripe — no circular dependency.
export const billingService = createBillingService(
  db,
  process.env.STRIPE_SECRET_KEY!
)

export const auth = createAuth({
  db,
  emailClient,
  baseUrl: process.env.BETTER_AUTH_URL!,
  secret: process.env.BETTER_AUTH_SECRET!,
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID!,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
  },
  stripe: {
    secretKey: process.env.STRIPE_SECRET_KEY!,
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET!,
    proMonthlyPriceId: process.env.STRIPE_PRO_MONTHLY_PRICE_ID!,
    proAnnualPriceId: process.env.STRIPE_PRO_ANNUAL_PRICE_ID!,
  },
  logger,
  getRequestHeaders,
  hooks: {
    beforeCreateOrganization: async (userId) => {
      await billingService.checkWorkspaceLimit(userId)
    },
    beforeCreateInvitation: async (organizationId) => {
      await billingService.checkMemberLimit(organizationId)
    },
  },
})
