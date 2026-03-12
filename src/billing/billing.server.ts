import { getRequestHeaders } from '@tanstack/react-start/server';
import { redirect } from '@tanstack/react-router';
import { and, count, eq } from 'drizzle-orm';
import { auth } from '@/auth/auth.server';
import {
  getPlanLimitsForPlanId,
  normalizePlanId,
  resolveUserPlanId,
} from '@/billing/plans';
import type { PlanId, PlanLimits } from '@/billing/plans';
import { db } from '@/db';
import {
  member as memberTable,
  subscription as subscriptionTable,
} from '@/db/schema';

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
  const headers = getRequestHeaders();
  const subscriptions = await auth.api.listActiveSubscriptions({
    headers,
    query: { referenceId: userId },
  });
  return resolveUserPlanId(Array.from(subscriptions));
}

/**
 * Returns the plan limits for a given user based on their subscription.
 */
export async function getUserPlanLimits(userId: string): Promise<PlanLimits> {
  const planId = await getUserActivePlanId(userId);
  return getPlanLimitsForPlanId(planId);
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
 * Returns the active subscription details for a user, or null if on the free tier.
 * Picks the subscription matching the user's highest-tier plan.
 */
export async function getUserSubscriptionDetails(
  userId: string,
  planId: PlanId,
): Promise<{
  status: string;
  periodEnd: Date | null;
  cancelAtPeriodEnd: boolean;
} | null> {
  const rows = await db
    .select({
      plan: subscriptionTable.plan,
      status: subscriptionTable.status,
      periodEnd: subscriptionTable.periodEnd,
      cancelAtPeriodEnd: subscriptionTable.cancelAtPeriodEnd,
    })
    .from(subscriptionTable)
    .where(eq(subscriptionTable.referenceId, userId));

  // Find the active/trialing subscription for the resolved plan.
  const active = rows.find(
    (r) =>
      (r.status === 'active' || r.status === 'trialing') &&
      normalizePlanId(r.plan ?? '') === planId,
  );
  if (!active || !active.status) return null;

  return {
    status: active.status,
    periodEnd: active.periodEnd ?? null,
    cancelAtPeriodEnd: active.cancelAtPeriodEnd ?? false,
  };
}
