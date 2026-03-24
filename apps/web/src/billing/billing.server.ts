import { redirect } from '@tanstack/react-router';
import { getRequestHeaders } from '@tanstack/react-start/server';
import { resolveSubscriptionDetails } from '@workspace/auth/billing';
import {
  getFreePlan,
  getPlanById,
  getPlanLimitsForPlanId,
  getUpgradePlan,
  resolveWorkspacePlanId,
} from '@workspace/auth/plans';
import type { Plan, PlanId, PlanLimits } from '@workspace/auth/plans';
import { auth } from '@/init';

export async function requireVerifiedSession() {
  const headers = getRequestHeaders();
  const session = await auth.api.getSession({ headers });
  if (!session || !session.user.emailVerified) {
    throw redirect({ to: '/signin' });
  }
  return session;
}

/**
 * Returns the active plan ID for a workspace using Better Auth's subscription API.
 * Delegates to resolveWorkspacePlanId() (pure function in plans.ts) for plan resolution.
 */
export async function getWorkspaceActivePlanId(
  headers: Headers,
  workspaceId: string
): Promise<PlanId> {
  const subscriptions = await auth.api.listActiveSubscriptions({
    headers,
    query: { referenceId: workspaceId },
  });
  return resolveWorkspacePlanId(Array.from(subscriptions));
}

export interface WorkspacePlanContext {
  planId: PlanId;
  plan: Plan;
  planName: string;
  limits: PlanLimits;
  upgradePlan: Plan | null;
}

/**
 * Resolves a workspace's full plan context — plan, limits, and upgrade path.
 * Consolidates the repeated plan resolution pattern used by billing data
 * and plan limit checks.
 */
export async function getWorkspacePlanContext(
  headers: Headers,
  workspaceId: string
): Promise<WorkspacePlanContext> {
  const planId = await getWorkspaceActivePlanId(headers, workspaceId);
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
 * Returns the workspace's billing state for the billing page.
 * Fetches subscriptions once and derives both plan context and
 * subscription details from the same data.
 */
export async function getWorkspaceBillingData(
  headers: Headers,
  workspaceId: string
) {
  const subscriptions = await auth.api.listActiveSubscriptions({
    headers,
    query: { referenceId: workspaceId },
  });
  const subArray = Array.from(subscriptions);

  const planId = resolveWorkspacePlanId(subArray);
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
 * Checks whether a workspace can perform a plan-limited action.
 * Resolves the workspace's own plan directly.
 */
export async function checkWorkspacePlanLimit(
  headers: Headers,
  workspaceId: string,
  _feature: 'member'
): Promise<CheckPlanLimitResult> {
  const ctx = await getWorkspacePlanContext(headers, workspaceId);
  const limit = ctx.limits.maxMembers;
  if (limit === -1) {
    return {
      allowed: true,
      current: 0,
      limit: -1,
      planName: ctx.planName,
      upgradePlan: ctx.upgradePlan,
    };
  }
  const current = await auth.billing.countWorkspaceMembers(workspaceId);
  return {
    allowed: current < limit,
    current,
    limit,
    planName: ctx.planName,
    upgradePlan: ctx.upgradePlan,
  };
}

/**
 * Creates a Stripe Checkout session to subscribe a workspace to a plan.
 * PlanId maps 1:1 to Better Auth's plan name — no translation needed.
 */
export async function createCheckoutForWorkspace(
  headers: Headers,
  workspaceId: string,
  planId: PlanId,
  annual: boolean
) {
  const result = await auth.api.upgradeSubscription({
    headers,
    body: {
      plan: planId,
      annual,
      successUrl: `${process.env.BETTER_AUTH_URL}/ws/${workspaceId}/billing?success=true`,
      cancelUrl: `${process.env.BETTER_AUTH_URL}/ws/${workspaceId}/billing`,
    },
  });

  return { url: result.url, redirect: result.redirect };
}

/**
 * Creates a Stripe Customer Portal session for managing the workspace subscription.
 */
export async function createWorkspaceBillingPortal(
  headers: Headers,
  workspaceId: string
) {
  const result = await auth.api.createBillingPortal({
    headers,
    body: {
      returnUrl: `${process.env.BETTER_AUTH_URL}/ws/${workspaceId}/billing`,
    },
  });
  return { url: result.url, redirect: result.redirect };
}

/**
 * Reactivates a subscription that was set to cancel at period end.
 * Picks the highest-tier active subscription and restores it.
 */
export async function reactivateWorkspaceSubscription(
  headers: Headers,
  workspaceId: string
) {
  const subscriptions = await auth.api.listActiveSubscriptions({
    headers,
    query: { referenceId: workspaceId },
  });

  const active = subscriptions.filter(
    (s) => s.status === 'active' || s.status === 'trialing'
  );

  if (active.length === 0) {
    throw new Error('No active subscription found.');
  }

  const bestPlanId = resolveWorkspacePlanId(active);
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
