import {
  clearWorkspaceEntitlementOverridesRow,
  countWorkspaceMembersFromDb,
  getWorkspaceEntitlementOverridesRow,
  listSubscriptionsForWorkspace,
  setWorkspaceEntitlementOverridesRow,
} from '../infrastructure/workspace-repository';
import { BillingDomainError } from '../contracts/errors';
import { parseWorkspaceBillingSnapshot } from '../contracts/snapshot';
import {
  PLANS,
  checkLimit,
  getFreePlan,
  getPlanAction,
  getPlanById,
  getUpgradePlan,
  resolveEntitlements,
  resolveWorkspacePlanId,
} from '../domain/plans';
import { resolveSubscriptionDetails } from '../domain/subscriptions';
import type {
  EntitlementOverrides,
  FeatureKey,
  LimitKey,
  PlanAction,
  PlanId,
} from '../domain/plans';
import type { WorkspaceBillingSnapshot } from '../contracts/snapshot';
import type { Database } from '@workspace/db';

export interface BillingSnapshotInput {
  db: Database;
  workspaceId: string;
  resolveScheduledTargetPlanId?: (scheduleId: string) => Promise<PlanId | null>;
}

function toEntitlementOverrides(
  overrideRow: {
    limits: EntitlementOverrides['limits'] | null;
    features: EntitlementOverrides['features'] | null;
    quotas: EntitlementOverrides['quotas'] | null;
  } | null
): EntitlementOverrides | undefined {
  if (overrideRow === null) return undefined;
  return {
    limits: overrideRow.limits ?? undefined,
    features: overrideRow.features ?? undefined,
    quotas: overrideRow.quotas ?? undefined,
  };
}

async function loadWorkspaceContext(db: Database, workspaceId: string) {
  const subscriptions = await listSubscriptionsForWorkspace(db, workspaceId);
  const subscriptionRows = subscriptions.map((s) => ({
    plan: s.plan,
    status: s.status ?? '',
  }));
  const planId = resolveWorkspacePlanId(subscriptionRows);
  const plan = getPlanById(planId) ?? getFreePlan();
  const subscription = resolveSubscriptionDetails(
    subscriptions.map((s) => ({
      plan: s.plan,
      status: s.status ?? '',
      stripeSubscriptionId: s.stripeSubscriptionId,
      stripeScheduleId: s.stripeScheduleId,
      periodEnd: s.periodEnd,
      cancelAtPeriodEnd: s.cancelAtPeriodEnd,
      cancelAt: s.cancelAt,
    })),
    planId
  );
  const overrideRow = plan.isEnterprise
    ? await getWorkspaceEntitlementOverridesRow(db, workspaceId)
    : null;
  const overrides = toEntitlementOverrides(overrideRow);
  const entitlements = resolveEntitlements(plan.entitlements, overrides);
  return { planId, plan, entitlements, subscription };
}

export async function getWorkspaceBillingSnapshot(
  input: BillingSnapshotInput
): Promise<WorkspaceBillingSnapshot> {
  const { db, workspaceId, resolveScheduledTargetPlanId } = input;
  const { planId, plan, entitlements, subscription } =
    await loadWorkspaceContext(db, workspaceId);

  const scheduledTargetPlanId = subscription?.stripeScheduleId
    ? await resolveScheduledTargetPlanId?.(subscription.stripeScheduleId)
    : null;

  const isScheduleStale =
    !!subscription?.stripeScheduleId &&
    (!scheduledTargetPlanId || scheduledTargetPlanId === planId);

  const cleanedSubscription = {
    status: subscription?.status ?? null,
    stripeSubscriptionId: subscription?.stripeSubscriptionId ?? null,
    stripeScheduleId: isScheduleStale
      ? null
      : (subscription?.stripeScheduleId ?? null),
    periodEnd: subscription?.periodEnd ?? null,
    cancelAtPeriodEnd: subscription?.cancelAtPeriodEnd ?? false,
    cancelAt: subscription?.cancelAt ?? null,
  };

  const actions = Object.fromEntries(
    PLANS.map((target) => [target.id, getPlanAction(plan, target)])
  ) as Record<string, PlanAction>;

  const memberCount = await countWorkspaceMembersFromDb(db, workspaceId);

  return parseWorkspaceBillingSnapshot({
    workspaceId,
    currentPlanId: planId,
    currentEntitlements: entitlements,
    subscriptionState: cleanedSubscription,
    catalogPlans: PLANS,
    targetActionsByPlan: actions,
    scheduledTargetPlanId: isScheduleStale
      ? null
      : (scheduledTargetPlanId ?? null),
    memberCount,
  });
}

export async function getWorkspaceEntitlements(input: {
  db: Database;
  workspaceId: string;
}) {
  const ctx = await loadWorkspaceContext(input.db, input.workspaceId);
  return ctx.entitlements;
}

export async function previewPlanChange(input: {
  db: Database;
  workspaceId: string;
  targetPlanId: PlanId;
}) {
  const ctx = await loadWorkspaceContext(input.db, input.workspaceId);
  const targetPlan = getPlanById(input.targetPlanId);
  if (!targetPlan) {
    throw new BillingDomainError(
      'WORKSPACE_NOT_FOUND',
      `Target plan "${input.targetPlanId}" does not exist.`
    );
  }
  return {
    action: getPlanAction(ctx.plan, targetPlan),
    currentPlan: ctx.plan,
    targetPlan,
  };
}

export async function getWorkspaceEntitlementOverrides(input: {
  db: Database;
  workspaceId: string;
}) {
  const row = await getWorkspaceEntitlementOverridesRow(
    input.db,
    input.workspaceId
  );
  if (row === null) return null;
  return {
    id: row.id,
    limits: row.limits,
    features: row.features,
    quotas: row.quotas,
    notes: row.notes,
  };
}

export async function setWorkspaceEntitlementOverrides(input: {
  db: Database;
  workspaceId: string;
  limits?: EntitlementOverrides['limits'];
  features?: EntitlementOverrides['features'];
  quotas?: EntitlementOverrides['quotas'];
  notes?: string | null;
}) {
  await setWorkspaceEntitlementOverridesRow(input.db, {
    workspaceId: input.workspaceId,
    limits: input.limits,
    features: input.features,
    quotas: input.quotas,
    notes: input.notes ?? null,
  });
  return { success: true as const };
}

export async function clearWorkspaceEntitlementOverrides(input: {
  db: Database;
  workspaceId: string;
}) {
  await clearWorkspaceEntitlementOverridesRow(input.db, input.workspaceId);
  return { success: true as const };
}

export async function assertWorkspaceLimit(input: {
  db: Database;
  workspaceId: string;
  key: LimitKey;
  currentUsage?: number;
}) {
  const ctx = await loadWorkspaceContext(input.db, input.workspaceId);
  const current =
    input.currentUsage ??
    (await countWorkspaceMembersFromDb(input.db, input.workspaceId));
  const result = checkLimit(ctx.entitlements, input.key, current);

  if (!result.allowed) {
    throw new BillingDomainError(
      'LIMIT_EXCEEDED',
      `This workspace has reached its ${input.key} limit (${result.limit}).`,
      {
        key: input.key,
        limit: result.limit,
        current: result.current,
        planName: ctx.plan.name,
        upgradePlan: getUpgradePlan(ctx.plan)?.id ?? null,
      }
    );
  }

  return {
    allowed: true as const,
    current: result.current,
    limit: result.limit,
    planName: ctx.plan.name,
    upgradePlan: getUpgradePlan(ctx.plan) ?? null,
  };
}

export async function assertWorkspaceFeature(input: {
  db: Database;
  workspaceId: string;
  key: FeatureKey;
}) {
  const ctx = await loadWorkspaceContext(input.db, input.workspaceId);
  if (!ctx.entitlements.features[input.key]) {
    throw new BillingDomainError(
      'FEATURE_NOT_ENABLED',
      `Feature "${input.key}" is not enabled on the ${ctx.plan.name} plan.`,
      { key: input.key, planName: ctx.plan.name }
    );
  }
  return { allowed: true as const };
}

export async function assertInviteAllowed(input: {
  db: Database;
  workspaceId: string;
  pendingInvites?: number;
}) {
  const pendingInvites = input.pendingInvites ?? 0;
  const current = await countWorkspaceMembersFromDb(
    input.db,
    input.workspaceId
  );
  return assertWorkspaceLimit({
    db: input.db,
    workspaceId: input.workspaceId,
    key: 'members',
    currentUsage: current + pendingInvites,
  });
}

export async function createCheckoutSession(input: {
  db: Database;
  workspaceId: string;
  targetPlanId: PlanId;
  annual: boolean;
  subscriptionId?: string;
  successUrl: string;
  cancelUrl: string;
  execute: (body: {
    plan: PlanId;
    annual: boolean;
    referenceId: string;
    customerType: 'organization';
    subscriptionId?: string;
    successUrl: string;
    cancelUrl: string;
  }) => Promise<{ url: string; redirect: boolean }>;
}) {
  const ctx = await loadWorkspaceContext(input.db, input.workspaceId);
  const targetPlan = getPlanById(input.targetPlanId);
  if (!targetPlan) {
    throw new BillingDomainError(
      'CHECKOUT_NOT_ALLOWED',
      `Checkout is not available for plan "${input.targetPlanId}".`,
      { planId: input.targetPlanId }
    );
  }

  const action = getPlanAction(ctx.plan, targetPlan);

  if (action === 'contact_sales' || targetPlan.isEnterprise) {
    throw new BillingDomainError(
      'CONTACT_SALES_REQUIRED',
      `Checkout is not available for plan "${input.targetPlanId}". Contact sales for enterprise plans.`,
      { planId: input.targetPlanId }
    );
  }

  if (action !== 'upgrade' || !targetPlan.stripeEnabled) {
    throw new BillingDomainError(
      'CHECKOUT_NOT_ALLOWED',
      `Checkout is not available for plan "${input.targetPlanId}".`,
      { action, planId: input.targetPlanId }
    );
  }

  return input.execute({
    plan: input.targetPlanId,
    annual: input.annual,
    referenceId: input.workspaceId,
    customerType: 'organization',
    ...(input.subscriptionId ? { subscriptionId: input.subscriptionId } : {}),
    successUrl: input.successUrl,
    cancelUrl: input.cancelUrl,
  });
}
