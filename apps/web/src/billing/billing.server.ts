import { redirect } from '@tanstack/react-router';
import { getRequestHeaders } from '@tanstack/react-start/server';
import type { PlanDefinition, PlanId } from '@/billing/core';
import {
  BillingDomainError,
  PLANS,
  assertWorkspaceLimit,
  createCheckoutSession,
  evaluateWorkspaceProductPolicy,
  getFreePlan,
  getPlanById,
  getProductUpgradeActionForPlan,
  getWorkspaceBillingSnapshot,
  getWorkspaceEntitlements as getWorkspaceEntitlementsQuery,
  resolveSubscriptionDetails,
  resolveWorkspacePlanId,
} from '@/billing/core';
import { getAuth, getDb } from '@/init.server';

export async function requireVerifiedSession() {
  const headers = getRequestHeaders();
  const session = await getAuth().api.getSession({ headers });
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
  const subscriptions = await getAuth().api.listActiveSubscriptions({
    headers,
    query: { referenceId: workspaceId, customerType: 'organization' },
  });
  return resolveWorkspacePlanId(Array.from(subscriptions));
}

export interface WorkspaceEntitlementsContext {
  planId: PlanId;
  plan: PlanDefinition;
  entitlements: Awaited<ReturnType<typeof getWorkspaceEntitlementsQuery>>;
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
  const entitlements = await getWorkspaceEntitlementsQuery({
    db: getDb(),
    workspaceId,
  });
  const upgradePlan = PLANS.find((p) => p.tier > plan.tier) ?? null;
  return { planId, plan, entitlements, upgradePlan };
}

/**
 * Returns the workspace's billing state for the billing page.
 * Fetches subscriptions once and derives both plan context and
 * subscription details from the same data.
 */
export async function getWorkspaceBillingData(
  _headers: Headers,
  workspaceId: string
) {
  const snapshot = await getWorkspaceBillingSnapshot({
    db: getDb(),
    workspaceId,
    resolveScheduledTargetPlanId,
  });
  const planId = snapshot.currentPlanId;
  const plan = getPlanById(planId) ?? getFreePlan();
  const hasSubscription =
    snapshot.subscriptionState.status !== null ||
    snapshot.subscriptionState.stripeSubscriptionId !== null;
  const productPolicy = evaluateWorkspaceProductPolicy({
    currentPlan: plan,
    resolvedEntitlements: snapshot.currentEntitlements,
    subscriptionState: snapshot.subscriptionState,
    scheduledTargetPlanId: snapshot.scheduledTargetPlanId,
  });
  return {
    planId,
    plan,
    entitlements: snapshot.currentEntitlements,
    subscription: hasSubscription ? snapshot.subscriptionState : null,
    scheduledTargetPlanId: snapshot.scheduledTargetPlanId,
    memberCount: snapshot.memberCount,
    productPolicy,
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
  const auth = getAuth();
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
  upgradeAction: 'checkout' | 'contact_sales' | 'none';
}

/**
 * Checks whether a workspace can perform an entitlement-limited action.
 * Resolves the workspace's entitlements (including enterprise overrides).
 */
export async function checkWorkspaceEntitlement(
  _headers: Headers,
  workspaceId: string,
  key: 'members'
): Promise<CheckEntitlementResult> {
  try {
    const result = await assertWorkspaceLimit({
      db: getDb(),
      workspaceId,
      key,
    });
    return {
      allowed: true,
      current: result.current,
      limit: result.limit,
      planName: result.planName,
      upgradePlan: result.upgradePlan,
      upgradeAction: getProductUpgradeActionForPlan(result.upgradePlan),
    };
  } catch (error) {
    if (
      error instanceof BillingDomainError &&
      error.code === 'LIMIT_EXCEEDED'
    ) {
      const metadata = error.metadata ?? {};
      return {
        allowed: false,
        current: Number(metadata.current ?? 0),
        limit: Number(metadata.limit ?? 0),
        planName: String(metadata.planName ?? 'Current'),
        upgradePlan:
          getPlanById(String(metadata.upgradePlan ?? 'free') as PlanId) ?? null,
        upgradeAction: getProductUpgradeActionForPlan(
          getPlanById(String(metadata.upgradePlan ?? 'free') as PlanId) ?? null
        ),
      };
    }
    throw error;
  }
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
  return createCheckoutSession({
    db: getDb(),
    workspaceId,
    targetPlanId: planId,
    annual,
    subscriptionId,
    successUrl: `${process.env.BETTER_AUTH_URL}/ws/${workspaceId}/billing?success=true`,
    cancelUrl: `${process.env.BETTER_AUTH_URL}/ws/${workspaceId}/billing`,
    execute: async (body) => {
      const result = await getAuth().api.upgradeSubscription({
        headers,
        body,
      });
      if (!result.url) {
        throw new Error('Checkout session did not return a redirect URL.');
      }
      return { url: result.url, redirect: result.redirect };
    },
  });
}

/**
 * Creates a Stripe Customer Portal session for managing the workspace subscription.
 */
export async function createWorkspaceBillingPortal(
  headers: Headers,
  workspaceId: string
) {
  const result = await getAuth().api.createBillingPortal({
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
  const auth = getAuth();
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
    const auth = getAuth();
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
  const auth = getAuth();
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
  const auth = getAuth();
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
