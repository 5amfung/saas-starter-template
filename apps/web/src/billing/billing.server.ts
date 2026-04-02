import { redirect } from '@tanstack/react-router';
import { getRequestHeaders } from '@tanstack/react-start/server';
import { resolveSubscriptionDetails } from '@workspace/auth/billing';
import {
  PLANS,
  getFreePlan,
  getPlanById,
  getUpgradePlan,
  resolveEntitlements,
  resolveWorkspacePlanId,
} from '@workspace/auth/plans';
import type {
  Entitlements,
  EntitlementOverrides,
  PlanDefinition,
  PlanId,
} from '@workspace/auth/plans';
import { workspaceEntitlementOverrides } from '@workspace/db-schema';
import { eq } from 'drizzle-orm';
import { auth, db } from '@/init';

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
    query: { referenceId: workspaceId, customerType: 'organization' },
  });
  return resolveWorkspacePlanId(Array.from(subscriptions));
}

export interface WorkspaceEntitlementsContext {
  planId: PlanId;
  plan: PlanDefinition;
  entitlements: Entitlements;
  upgradePlan: PlanDefinition | null;
}

/**
 * Resolves a workspace's full entitlement context — plan, entitlements,
 * and upgrade path. Enterprise workspaces may have per-workspace overrides
 * stored in the database.
 */
export async function getWorkspaceEntitlements(
  headers: Headers,
  workspaceId: string
): Promise<WorkspaceEntitlementsContext> {
  const planId = await getWorkspaceActivePlanId(headers, workspaceId);
  const plan = getPlanById(planId) ?? getFreePlan();
  const upgradePlan = getUpgradePlan(plan);

  // Project only entitlement fields from the DB row — never pass the full row.
  const overrideRow = plan.isEnterprise
    ? await db.query.workspaceEntitlementOverrides.findFirst({
        where: eq(workspaceEntitlementOverrides.workspaceId, workspaceId),
      })
    : undefined;

  // Cast from Record<string, ...> (DB layer) to EntitlementOverrides (typed keys).
  const overrides: EntitlementOverrides | undefined = overrideRow
    ? {
        limits: overrideRow.limits as EntitlementOverrides['limits'],
        features: overrideRow.features as EntitlementOverrides['features'],
        quotas: overrideRow.quotas as EntitlementOverrides['quotas'],
      }
    : undefined;

  const entitlements = resolveEntitlements(plan.entitlements, overrides);
  return { planId, plan, entitlements, upgradePlan };
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
    query: { referenceId: workspaceId, customerType: 'organization' },
  });
  const subArray = Array.from(subscriptions);

  const planId = resolveWorkspacePlanId(subArray);
  const plan = getPlanById(planId) ?? getFreePlan();
  const subscription = resolveSubscriptionDetails(subArray, planId);

  // Resolve scheduled target plan from Stripe Subscription Schedule.
  const scheduledTargetPlanId = subscription?.stripeScheduleId
    ? await resolveScheduledTargetPlanId(subscription.stripeScheduleId)
    : null;

  // Strip the stale stripeScheduleId when the schedule is no longer meaningful:
  // either it resolved to null (completed/canceled) or the target plan matches
  // the current plan (the downgrade already took effect).
  const isScheduleStale =
    !!subscription?.stripeScheduleId &&
    (!scheduledTargetPlanId || scheduledTargetPlanId === planId);
  const cleanedSubscription = isScheduleStale
    ? { ...subscription, stripeScheduleId: null }
    : subscription;

  // Resolve entitlements (with enterprise overrides if applicable).
  const overrideRow = plan.isEnterprise
    ? await db.query.workspaceEntitlementOverrides.findFirst({
        where: eq(workspaceEntitlementOverrides.workspaceId, workspaceId),
      })
    : undefined;

  const overrides: EntitlementOverrides | undefined = overrideRow
    ? {
        limits: overrideRow.limits as EntitlementOverrides['limits'],
        features: overrideRow.features as EntitlementOverrides['features'],
        quotas: overrideRow.quotas as EntitlementOverrides['quotas'],
      }
    : undefined;

  const entitlements = resolveEntitlements(plan.entitlements, overrides);

  // Count workspace members for UI display.
  const memberCount = await auth.billing.countWorkspaceMembers(workspaceId);

  return {
    planId,
    plan,
    entitlements,
    subscription: cleanedSubscription,
    scheduledTargetPlanId: isScheduleStale ? null : scheduledTargetPlanId,
    memberCount,
  };
}

export interface WorkspaceBillingSummary {
  workspaceId: string;
  workspaceName: string;
  planName: string;
  status: string | null;
  periodEnd: string | null;
}

/**
 * Returns billing summaries for all workspaces the user owns.
 * Used by the account-level billing overview page.
 */
export async function getOwnedWorkspacesBillingSummary(
  headers: Headers
): Promise<Array<WorkspaceBillingSummary>> {
  const workspaces = await auth.api.listOrganizations({ headers });

  const summaries: Array<WorkspaceBillingSummary> = [];
  for (const ws of workspaces) {
    const memberships = await auth.api.getFullOrganization({
      headers,
      query: { organizationId: ws.id },
    });
    const userId = (await auth.api.getSession({ headers }))?.user.id;
    const isOwner = memberships?.members.some(
      (m) => m.userId === userId && m.role === 'owner'
    );
    if (!isOwner) continue;

    const subscriptions = await auth.api.listActiveSubscriptions({
      headers,
      query: { referenceId: ws.id, customerType: 'organization' },
    });
    const subArray = Array.from(subscriptions);
    const planId = resolveWorkspacePlanId(subArray);
    const plan = getPlanById(planId) ?? getFreePlan();
    const subscription = resolveSubscriptionDetails(subArray, planId);

    summaries.push({
      workspaceId: ws.id,
      workspaceName: ws.name,
      planName: plan.name,
      status: subscription?.status ?? null,
      periodEnd: subscription?.periodEnd?.toISOString() ?? null,
    });
  }

  return summaries;
}

export interface CheckEntitlementResult {
  allowed: boolean;
  current: number;
  limit: number;
  planName: string;
  upgradePlan: PlanDefinition | null;
}

/**
 * Checks whether a workspace can perform an entitlement-limited action.
 * Resolves the workspace's entitlements (including enterprise overrides).
 */
export async function checkWorkspaceEntitlement(
  headers: Headers,
  workspaceId: string,
  key: 'members'
): Promise<CheckEntitlementResult> {
  const ctx = await getWorkspaceEntitlements(headers, workspaceId);
  const limit = ctx.entitlements.limits[key];

  if (limit === -1) {
    return {
      allowed: true,
      current: 0,
      limit: -1,
      planName: ctx.plan.name,
      upgradePlan: ctx.upgradePlan,
    };
  }

  const current = await auth.billing.countWorkspaceMembers(workspaceId);
  return {
    allowed: current < limit,
    current,
    limit,
    planName: ctx.plan.name,
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
  annual: boolean,
  subscriptionId?: string
) {
  const result = await auth.api.upgradeSubscription({
    headers,
    body: {
      plan: planId,
      annual,
      referenceId: workspaceId,
      customerType: 'organization',
      ...(subscriptionId ? { subscriptionId } : {}),
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
      referenceId: workspaceId,
      customerType: 'organization',
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
    query: { referenceId: workspaceId, customerType: 'organization' },
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

  if (target.stripeScheduleId) {
    await auth.billing.releaseSubscriptionSchedule(target.stripeScheduleId);
  } else {
    await auth.api.restoreSubscription({
      headers,
      body: {
        subscriptionId: target.stripeSubscriptionId,
        referenceId: workspaceId,
        customerType: 'organization',
      },
    });
  }

  return { success: true };
}

/**
 * Resolves the target plan ID from a Stripe Subscription Schedule.
 * Reads the second phase's first item price and maps it back to a PlanId.
 * Returns null if the schedule cannot be resolved.
 */
async function resolveScheduledTargetPlanId(
  scheduleId: string
): Promise<PlanId | null> {
  try {
    const schedule = await auth.billing.getSubscriptionSchedule(scheduleId);
    // A completed or canceled schedule is no longer pending — ignore it.
    if (schedule.status !== 'active' && schedule.status !== 'not_started') {
      return null;
    }
    if (schedule.phases.length < 2) return null;

    const secondPhase = schedule.phases[1];
    const firstItem = secondPhase.items[0];

    const priceId =
      typeof firstItem.price === 'string'
        ? firstItem.price
        : firstItem.price.id;
    if (!priceId) return null;

    return auth.billing.getPlanIdByPriceId(priceId);
  } catch {
    return null;
  }
}

/**
 * Schedules a workspace subscription downgrade at the end of the current billing period.
 * The target plan must be a lower tier than the current plan and must have pricing.
 */
export async function downgradeWorkspaceSubscription(
  headers: Headers,
  workspaceId: string,
  planId: PlanId,
  annual: boolean,
  subscriptionId: string
) {
  // Validate the target plan exists and has pricing.
  const targetPlan = PLANS.find((p) => p.id === planId);
  if (!targetPlan) {
    throw new Error(`Unknown plan: ${planId}`);
  }
  if (!targetPlan.pricing) {
    throw new Error('Cannot downgrade to a plan without pricing.');
  }

  // Validate the target plan is a lower tier than the current plan.
  const currentPlanId = await getWorkspaceActivePlanId(headers, workspaceId);
  const currentPlan = PLANS.find((p) => p.id === currentPlanId);
  if (!currentPlan || targetPlan.tier >= currentPlan.tier) {
    throw new Error('Target plan must be a lower tier than the current plan.');
  }

  await auth.api.upgradeSubscription({
    headers,
    body: {
      plan: planId,
      annual,
      referenceId: workspaceId,
      customerType: 'organization',
      subscriptionId,
      scheduleAtPeriodEnd: true,
    },
  });

  return { success: true };
}

/**
 * Cancels a workspace subscription at the end of the current billing period.
 * Finds the active subscription and sets cancel_at_period_end on it.
 */
export async function cancelWorkspaceSubscription(
  headers: Headers,
  workspaceId: string
) {
  const subscriptions = await auth.api.listActiveSubscriptions({
    headers,
    query: { referenceId: workspaceId, customerType: 'organization' },
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
    throw new Error('Could not find subscription to cancel.');
  }

  await auth.billing.cancelSubscriptionAtPeriodEnd(target.stripeSubscriptionId);

  return { success: true };
}
