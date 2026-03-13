import { getRequestHeaders } from '@tanstack/react-start/server';
import { redirect } from '@tanstack/react-router';
import { and, count, eq } from 'drizzle-orm';
import Stripe from 'stripe';
import { auth } from '@/auth/auth.server';
import {
  getFreePlan,
  getPlanById,
  getPlanLimitsForPlanId,
  getUpgradePlan,
  resolveUserPlanId,
} from '@/billing/plans';
import type { Plan, PlanId, PlanLimits } from '@/billing/plans';
import { db } from '@/db';
import {
  member as memberTable,
  subscription as subscriptionTable,
  user as userTable,
} from '@/db/schema';

const stripeClient = new Stripe(process.env.STRIPE_SECRET_KEY!);

export async function requireVerifiedSession() {
  const headers = getRequestHeaders();
  const session = await auth.api.getSession({ headers });
  if (!session || !session.user.emailVerified) {
    throw redirect({ to: '/signin' });
  }
  return session;
}

/**
 * Returns the active plan ID for a user using Better Auth's subscription API.
 * Delegates to resolveUserPlanId() (pure function in plans.ts) for plan resolution.
 */
export async function getUserActivePlanId(
  headers: Headers,
  userId: string,
): Promise<PlanId> {
  const subscriptions = await auth.api.listActiveSubscriptions({
    headers,
    query: { referenceId: userId },
  });
  return resolveUserPlanId(Array.from(subscriptions));
}

export interface UserPlanContext {
  planId: PlanId;
  plan: Plan;
  planName: string;
  limits: PlanLimits;
  upgradePlan: Plan | null;
}

/**
 * Resolves a user's full plan context — plan, limits, and upgrade path.
 * Consolidates the repeated plan resolution pattern used by billing data
 * and plan limit checks.
 */
export async function getUserPlanContext(
  headers: Headers,
  userId: string,
): Promise<UserPlanContext> {
  const planId = await getUserActivePlanId(headers, userId);
  const plan = getPlanById(planId) ?? getFreePlan();
  const limits = getPlanLimitsForPlanId(planId);
  const upgradePlan = getUpgradePlan(plan);

  return {
    planId,
    plan,
    planName: plan.name,
    limits,
    upgradePlan,
  };
}

/**
 * Extracts subscription details from an in-memory subscription list.
 * Pure function — no DB or API calls. Used by getBillingData to avoid
 * a redundant round trip after listActiveSubscriptions already fetched
 * the same data.
 */
export function resolveSubscriptionDetails(
  subscriptions: ReadonlyArray<{
    plan: string;
    status: string;
    periodEnd?: Date | null;
    cancelAtPeriodEnd?: boolean | null;
    cancelAt?: Date | null;
  }>,
  planId: PlanId,
): {
  status: string;
  periodEnd: Date | null;
  cancelAtPeriodEnd: boolean;
  cancelAt: Date | null;
} | null {
  const active = subscriptions.find(
    (s) =>
      (s.status === 'active' || s.status === 'trialing') && s.plan === planId,
  );
  if (!active) return null;

  return {
    status: active.status,
    periodEnd: active.periodEnd ?? null,
    cancelAtPeriodEnd: active.cancelAtPeriodEnd ?? false,
    cancelAt: active.cancelAt ?? null,
  };
}

/**
 * Returns the current user's billing state for the billing page.
 * Fetches subscriptions once and derives both plan context and
 * subscription details from the same data.
 */
export async function getBillingData(headers: Headers, userId: string) {
  const subscriptions = await auth.api.listActiveSubscriptions({
    headers,
    query: { referenceId: userId },
  });
  const subArray = Array.from(subscriptions);

  const planId = resolveUserPlanId(subArray);
  const plan = getPlanById(planId) ?? getFreePlan();
  const subscription = resolveSubscriptionDetails(subArray, planId);

  return { planId, plan, subscription };
}

export interface CheckPlanLimitResult {
  allowed: boolean;
  current: number;
  limit: number;
  planName: string;
  upgradePlan: Plan | null;
}

/**
 * Checks whether a user can perform a plan-limited action.
 * For workspace limits, checks the current user's plan.
 * For member limits, checks the workspace owner's plan.
 */
export async function checkUserPlanLimit(
  headers: Headers,
  userId: string,
  feature: 'workspace' | 'member',
  workspaceId?: string,
): Promise<CheckPlanLimitResult> {
  if (feature === 'workspace') {
    const ctx = await getUserPlanContext(headers, userId);
    const limit = ctx.limits.maxWorkspaces;
    if (limit === -1) {
      return {
        allowed: true,
        current: 0,
        limit: -1,
        planName: ctx.planName,
        upgradePlan: ctx.upgradePlan,
      };
    }
    const current = await countOwnedWorkspaces(userId);
    return {
      allowed: current < limit,
      current,
      limit,
      planName: ctx.planName,
      upgradePlan: ctx.upgradePlan,
    };
  }

  if (!workspaceId) {
    throw new Error('workspaceId is required for member limit check.');
  }

  // Member limits are based on the workspace owner's plan, not the
  // current user's plan. This mirrors the beforeCreateInvitation hook.
  const ownerId = await getWorkspaceOwnerUserId(workspaceId);
  if (!ownerId) {
    const ctx = await getUserPlanContext(headers, userId);
    return {
      allowed: true,
      current: 0,
      limit: -1,
      planName: ctx.planName,
      upgradePlan: ctx.upgradePlan,
    };
  }

  const ctx = await getUserPlanContext(headers, ownerId);
  const limit = ctx.limits.maxMembersPerWorkspace;
  if (limit === -1) {
    return {
      allowed: true,
      current: 0,
      limit: -1,
      planName: ctx.planName,
      upgradePlan: ctx.upgradePlan,
    };
  }
  const current = await countWorkspaceMembers(workspaceId);
  return {
    allowed: current < limit,
    current,
    limit,
    planName: ctx.planName,
    upgradePlan: ctx.upgradePlan,
  };
}

/**
 * Resolves a user's plan ID by querying the subscription table directly.
 * Unlike getUserActivePlanId, this does not require an HTTP session context,
 * making it safe to call from database hooks where no request headers exist.
 */
export async function resolveUserPlanIdFromDb(userId: string): Promise<PlanId> {
  const rows = await db
    .select({ plan: subscriptionTable.plan, status: subscriptionTable.status })
    .from(subscriptionTable)
    .where(eq(subscriptionTable.referenceId, userId));
  return resolveUserPlanId(
    rows.filter(
      (r): r is { plan: string; status: string } => r.status !== null,
    ),
  );
}

/**
 * Counts the number of workspaces where the user is an owner.
 * Used by both the plan limit check and the org creation hook.
 */
export async function countOwnedWorkspaces(userId: string): Promise<number> {
  const [result] = await db
    .select({ count: count() })
    .from(memberTable)
    .where(and(eq(memberTable.userId, userId), eq(memberTable.role, 'owner')));
  return result.count;
}

/**
 * Returns the owner's user ID for a workspace, or null if none found.
 * Used by the plan limit check to resolve the owner's plan for member limits.
 */
export async function getWorkspaceOwnerUserId(
  workspaceId: string,
): Promise<string | null> {
  const rows = await db
    .select({ userId: memberTable.userId })
    .from(memberTable)
    .where(
      and(
        eq(memberTable.organizationId, workspaceId),
        eq(memberTable.role, 'owner'),
      ),
    );
  if (rows.length === 0) return null;
  return rows[0].userId;
}

/**
 * Counts the number of members in a workspace.
 * Used by both the plan limit check and the invitation hook.
 */
export async function countWorkspaceMembers(
  workspaceId: string,
): Promise<number> {
  const [result] = await db
    .select({ count: count() })
    .from(memberTable)
    .where(eq(memberTable.organizationId, workspaceId));
  return result.count;
}

/**
 * Fetches a user's invoices from Stripe (past 12 months).
 */
export async function getInvoicesForUser(userId: string) {
  const [dbUser] = await db
    .select({ stripeCustomerId: userTable.stripeCustomerId })
    .from(userTable)
    .where(eq(userTable.id, userId));

  if (!dbUser.stripeCustomerId) return [];

  const SECONDS_PER_YEAR = 365 * 24 * 60 * 60;
  const twelveMonthsAgo = Math.floor(Date.now() / 1000) - SECONDS_PER_YEAR;
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
}

/**
 * Creates a Stripe Checkout session to subscribe to a plan.
 * PlanId maps 1:1 to Better Auth's plan name — no translation needed.
 */
export async function createCheckoutForPlan(
  headers: Headers,
  planId: PlanId,
  annual: boolean,
) {
  const result = await auth.api.upgradeSubscription({
    headers,
    body: {
      plan: planId,
      annual,
      successUrl: `${process.env.BETTER_AUTH_URL}/billing?success=true`,
      cancelUrl: `${process.env.BETTER_AUTH_URL}/billing`,
    },
  });

  return { url: result.url, redirect: result.redirect };
}

/**
 * Creates a Stripe Customer Portal session for managing the subscription.
 */
export async function createUserBillingPortal(headers: Headers) {
  const result = await auth.api.createBillingPortal({
    headers,
    body: {
      returnUrl: `${process.env.BETTER_AUTH_URL}/billing`,
    },
  });
  return { url: result.url, redirect: result.redirect };
}

/**
 * Reactivates a subscription that was set to cancel at period end.
 * Picks the highest-tier active subscription and restores it.
 */
export async function reactivateUserSubscription(
  headers: Headers,
  userId: string,
) {
  const subscriptions = await auth.api.listActiveSubscriptions({
    headers,
    query: { referenceId: userId },
  });

  const active = subscriptions.filter(
    (s) => s.status === 'active' || s.status === 'trialing',
  );

  if (active.length === 0) {
    throw new Error('No active subscription found.');
  }

  const bestPlanId = resolveUserPlanId(active);
  const target = active.find((s) => s.plan === bestPlanId);
  if (!target?.stripeSubscriptionId) {
    throw new Error('Could not find subscription to restore.');
  }

  await auth.api.restoreSubscription({
    headers,
    body: { subscriptionId: target.stripeSubscriptionId },
  });

  return { success: true };
}
