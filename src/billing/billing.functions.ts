import { createServerFn } from '@tanstack/react-start';
import Stripe from 'stripe';
import * as z from 'zod';
import { eq } from 'drizzle-orm';
import { auth } from '@/auth/auth.server';
import { requireVerifiedSession } from '@/billing/billing.server';
import { resolveUserPlanId } from '@/billing/plans';
import { db } from '@/db';
import { user as userTable } from '@/db/schema';

const stripeClient = new Stripe(process.env.STRIPE_SECRET_KEY!);

/**
 * Fetches the current user's invoices from Stripe (past 12 months).
 */
export const getInvoices = createServerFn().handler(async () => {
  const session = await requireVerifiedSession();

  // Look up the user's Stripe customer ID from the user table.
  const [dbUser] = await db
    .select({ stripeCustomerId: userTable.stripeCustomerId })
    .from(userTable)
    .where(eq(userTable.id, session.user.id));

  if (!dbUser.stripeCustomerId) return [];

  const twelveMonthsAgo = Math.floor(Date.now() / 1000) - 365 * 24 * 60 * 60;
  const invoices = await stripeClient.invoices.list({
    customer: dbUser.stripeCustomerId,
    limit: 100,
    created: { gte: twelveMonthsAgo },
  });

  return invoices.data.map((inv) => ({
    id: inv.id,
    date: inv.created,
    status: inv.status,
    amount: inv.amount_paid,
    currency: inv.currency,
    invoiceUrl: inv.hosted_invoice_url,
    invoicePdf: inv.invoice_pdf,
  }));
});

const upgradeInput = z.object({
  planId: z.string().min(1),
  annual: z.boolean().optional(),
});

/**
 * Creates a Stripe Checkout session to subscribe to a plan.
 * Uses auth.api server-side (not authClient, which is client-only).
 * Redirects the user to Stripe's hosted checkout page.
 */
export const createCheckoutSession = createServerFn()
  .inputValidator(upgradeInput)
  .handler(async ({ data }) => {
    await requireVerifiedSession();

    const result = await auth.api.upgradeSubscription({
      body: {
        plan: data.planId,
        annual: data.annual,
        successUrl: `${process.env.BETTER_AUTH_URL}/billing?success=true`,
        cancelUrl: `${process.env.BETTER_AUTH_URL}/billing`,
      },
    });

    // Extract only what the client needs to avoid Stripe SDK type version conflicts.
    return { url: result.url, redirect: result.redirect };
  });

/**
 * Creates a Stripe Customer Portal session for managing the subscription.
 * Redirects the user to Stripe's hosted portal.
 */
export const createPortalSession = createServerFn().handler(async () => {
  await requireVerifiedSession();

  const result = await auth.api.createBillingPortal({
    body: {
      returnUrl: `${process.env.BETTER_AUTH_URL}/billing`,
    },
  });
  return { url: result.url, redirect: result.redirect };
});

/**
 * Reactivates a subscription that was set to cancel at period end.
 * Uses Better Auth's restoreSubscription API.
 */
export const reactivateSubscription = createServerFn().handler(async () => {
  const session = await requireVerifiedSession();

  const subscriptions = await auth.api.listActiveSubscriptions({
    query: { referenceId: session.user.id },
  });

  const active = subscriptions.filter(
    (s) => s.status === 'active' || s.status === 'trialing',
  );

  if (active.length === 0) {
    throw new Error('No active subscription found.');
  }

  // Pick highest-tier subscription to reactivate.
  const bestPlanId = resolveUserPlanId(active);
  const target = active.find((s) => s.plan === bestPlanId);
  if (!target?.id) {
    throw new Error('Could not find subscription to restore.');
  }

  await auth.api.restoreSubscription({
    body: {
      subscriptionId: target.id,
    },
  });

  return { success: true };
});
