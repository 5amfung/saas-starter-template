import { createDb } from '@workspace/db';
import { createEmailClient } from '@workspace/email';
import { createAuth } from '@workspace/auth/server';
import type { StripePlanConfig } from '@workspace/auth';
import { createBillingService } from '@workspace/billing/server';
import { PLANS } from '@workspace/billing';
import { getRequestHeaders } from '@tanstack/react-start/server';
import { logger } from '@/lib/logger';

export const db = createDb(process.env.DATABASE_URL!);

export const emailClient = createEmailClient({
  apiKey: process.env.RESEND_API_KEY!,
  fromEmail: process.env.RESEND_FROM_EMAIL!,
  replyToEmail: process.env.RESEND_REPLY_TO_EMAIL,
  appName: process.env.VITE_APP_NAME || 'App',
  devPrefix: process.env.NODE_ENV !== 'production',
});

// Billing service must be created before auth since auth hooks use it.
// It only depends on db and Stripe — no circular dependency.
export const billingService = createBillingService(
  db,
  process.env.STRIPE_SECRET_KEY!
);

// Map billing PLANS to the shape Better Auth's Stripe plugin expects.
// Env vars follow the pattern STRIPE_<PLAN>_MONTHLY_PRICE_ID / STRIPE_<PLAN>_ANNUAL_PRICE_ID.
const stripePlans: Array<StripePlanConfig> = PLANS.filter(
  (p) => p.pricing !== null
).map((p) => {
  const key = p.id.toUpperCase();
  return {
    name: p.id,
    priceId: process.env[`STRIPE_${key}_MONTHLY_PRICE_ID`]!,
    annualDiscountPriceId: process.env[`STRIPE_${key}_ANNUAL_PRICE_ID`]!,
  };
});

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
    plans: stripePlans,
  },
  logger,
  getRequestHeaders,
  hooks: {
    beforeCreateOrganization: async (userId) => {
      await billingService.checkWorkspaceLimit(userId);
    },
    beforeCreateInvitation: async (organizationId) => {
      await billingService.checkMemberLimit(organizationId);
    },
  },
});
