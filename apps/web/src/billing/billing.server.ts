import { redirect } from '@tanstack/react-router';
import { getRequestHeaders } from '@tanstack/react-start/server';
import { resolveSubscriptionDetails } from '@workspace/auth/billing';
import {
  getFreePlan,
  getPlanById,
  getPlanLimitsForPlanId,
  getUpgradePlan,
  resolveUserPlanId,
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
 * Returns the active plan ID for a user using Better Auth's subscription API.
 * Delegates to resolveUserPlanId() (pure function in plans.ts) for plan resolution.
 */
export async function getUserActivePlanId(
  headers: Headers,
  userId: string
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
  userId: string
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
  workspaceId?: string
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
    const current = await auth.billing.countOwnedWorkspaces(userId);
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
  const ownerId = await auth.billing.getWorkspaceOwnerUserId(workspaceId);
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
 * Creates a Stripe Checkout session to subscribe to a plan.
 * PlanId maps 1:1 to Better Auth's plan name — no translation needed.
 */
export async function createCheckoutForPlan(
  headers: Headers,
  planId: PlanId,
  annual: boolean
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
  userId: string
) {
  const subscriptions = await auth.api.listActiveSubscriptions({
    headers,
    query: { referenceId: userId },
  });

  const active = subscriptions.filter(
    (s) => s.status === 'active' || s.status === 'trialing'
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
