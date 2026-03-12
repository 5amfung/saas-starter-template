import { createServerFn } from '@tanstack/react-start';
import { getRequestHeaders } from '@tanstack/react-start/server';
import Stripe from 'stripe';
import * as z from 'zod';
import { eq } from 'drizzle-orm';
import { auth } from '@/auth/auth.server';
import {
  countOwnedWorkspaces,
  countWorkspaceMembers,
  getUserActivePlanId,
  getUserSubscriptionDetails,
  getWorkspaceOwnerUserId,
  requireVerifiedSession,
} from '@/billing/billing.server';
import type { PlanId } from '@/billing/plans';
import {
  PLANS,
  getFreePlan,
  getPlanById,
  getPlanLimitsForPlanId,
  getUpgradePlan,
  resolveUserPlanId,
} from '@/billing/plans';
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

const VALID_PLAN_IDS = PLANS.map((p) => p.id) as [PlanId, ...Array<PlanId>];

const upgradeInput = z.object({
  planId: z.enum(VALID_PLAN_IDS),
  annual: z.boolean(),
});

/**
 * Creates a Stripe Checkout session to subscribe to a plan.
 * Uses auth.api server-side (not authClient, which is client-only).
 * Redirects the user to Stripe's hosted checkout page.
 */
export const createCheckoutSession = createServerFn()
  .inputValidator(upgradeInput)
  .handler(async ({ data }) => {
    const headers = getRequestHeaders();
    await requireVerifiedSession();

    // PlanId maps 1:1 to Better Auth's plan name — no translation needed.
    const result = await auth.api.upgradeSubscription({
      headers,
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
  const headers = getRequestHeaders();
  await requireVerifiedSession();

  const result = await auth.api.createBillingPortal({
    headers,
    body: {
      returnUrl: `${process.env.BETTER_AUTH_URL}/billing`,
    },
  });
  return { url: result.url, redirect: result.redirect };
});

/**
 * Returns the current user's billing state for the billing page.
 * Single server round-trip replaces the broken session.user.subscription approach.
 */
export const getUserBillingData = createServerFn().handler(async () => {
  const session = await requireVerifiedSession();
  const planId = await getUserActivePlanId(session.user.id);
  const plan = getPlanById(planId) ?? getFreePlan();
  const subscription = await getUserSubscriptionDetails(
    session.user.id,
    planId,
  );

  return { planId, plan, subscription };
});

/**
 * Reactivates a subscription that was set to cancel at period end.
 * Uses Better Auth's restoreSubscription API.
 */
export const reactivateSubscription = createServerFn().handler(async () => {
  const headers = getRequestHeaders();
  const session = await requireVerifiedSession();

  const subscriptions = await auth.api.listActiveSubscriptions({
    headers,
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
    headers,
    body: {
      subscriptionId: target.id,
    },
  });

  return { success: true };
});

const checkPlanLimitInput = z.object({
  feature: z.enum(['workspace', 'member']),
  workspaceId: z.string().optional(),
});

/**
 * Checks whether the current user can perform a plan-limited action.
 * Returns usage info for the UI to display in the upgrade prompt.
 */
export const checkPlanLimit = createServerFn()
  .inputValidator(checkPlanLimitInput)
  .handler(async ({ data }) => {
    const session = await requireVerifiedSession();
    const userId = session.user.id;
    const planId = await getUserActivePlanId(userId);
    const limits = getPlanLimitsForPlanId(planId);
    const plan = getPlanById(planId);
    const planName = plan?.name ?? 'Free';
    const upgradePlan = plan ? getUpgradePlan(plan) : null;

    if (data.feature === 'workspace') {
      const limit = limits.maxWorkspaces;
      if (limit === -1) {
        return { allowed: true, current: 0, limit: -1, planName, upgradePlan };
      }
      const current = await countOwnedWorkspaces(userId);
      return {
        allowed: current < limit,
        current,
        limit,
        planName,
        upgradePlan,
      };
    }

    if (!data.workspaceId) {
      throw new Error('workspaceId is required for member limit check.');
    }

    // Member limits are based on the workspace owner's plan, not the
    // current user's plan. This mirrors the beforeCreateInvitation hook.
    const ownerId = await getWorkspaceOwnerUserId(data.workspaceId);
    if (!ownerId) {
      return { allowed: true, current: 0, limit: -1, planName, upgradePlan };
    }
    const ownerPlanId = await getUserActivePlanId(ownerId);
    const ownerLimits = getPlanLimitsForPlanId(ownerPlanId);
    const ownerPlan = getPlanById(ownerPlanId);
    const ownerPlanName = ownerPlan?.name ?? 'Free';
    const ownerUpgradePlan = ownerPlan ? getUpgradePlan(ownerPlan) : null;

    const limit = ownerLimits.maxMembersPerWorkspace;
    if (limit === -1) {
      return {
        allowed: true,
        current: 0,
        limit: -1,
        planName: ownerPlanName,
        upgradePlan: ownerUpgradePlan,
      };
    }
    const current = await countWorkspaceMembers(data.workspaceId);
    return {
      allowed: current < limit,
      current,
      limit,
      planName: ownerPlanName,
      upgradePlan: ownerUpgradePlan,
    };
  });
