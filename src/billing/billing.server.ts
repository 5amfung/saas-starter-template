import { getRequestHeaders } from '@tanstack/react-start/server';
import { redirect } from '@tanstack/react-router';
import { auth } from '@/auth/auth.server';
import { getPlanLimitsForPlanId, resolveUserPlanId } from '@/billing/plans';
import type { PlanId, PlanLimits } from '@/billing/plans';

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
export async function getUserActivePlanId(userId: string): Promise<PlanId> {
  const subscriptions = await auth.api.listActiveSubscriptions({
    query: { referenceId: userId },
  });
  return resolveUserPlanId(subscriptions ?? []);
}

/**
 * Returns the plan limits for a given user based on their subscription.
 */
export async function getUserPlanLimits(userId: string): Promise<PlanLimits> {
  const planId = await getUserActivePlanId(userId);
  return getPlanLimitsForPlanId(planId);
}
