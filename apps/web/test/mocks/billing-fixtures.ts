import type { Entitlements, PlanDefinition, PlanId } from '@workspace/billing';

export const FREE_PLAN_FIXTURE: PlanDefinition = {
  id: 'free',
  name: 'Free',
  tier: 0,
  pricing: null,
  entitlements: {
    limits: { members: 1, projects: 1, apiKeys: 0 },
    features: {
      sso: false,
      auditLogs: false,
      apiAccess: false,
      prioritySupport: false,
    },
    quotas: { storageGb: 1, apiCallsMonthly: 0 },
  },
  stripeEnabled: false,
  isEnterprise: false,
};

export const PRO_PLAN_FIXTURE: PlanDefinition = {
  id: 'pro',
  name: 'Pro',
  tier: 2,
  pricing: { monthly: { price: 4900 }, annual: { price: 49000 } },
  entitlements: {
    limits: { members: 25, projects: 100, apiKeys: 5 },
    features: {
      sso: false,
      auditLogs: true,
      apiAccess: true,
      prioritySupport: true,
    },
    quotas: { storageGb: 50, apiCallsMonthly: 1000 },
  },
  stripeEnabled: true,
  isEnterprise: false,
};

export interface WorkspaceBillingDataFixture {
  planId: PlanId;
  plan: PlanDefinition;
  entitlements: Entitlements;
  subscription: {
    status?: string | null;
    stripeSubscriptionId?: string | null;
    stripeScheduleId?: string | null;
    periodEnd?: Date | string | null;
    cancelAtPeriodEnd?: boolean;
    cancelAt?: Date | string | null;
  } | null;
  scheduledTargetPlanId?: PlanId | null;
  memberCount?: number;
}

export function buildWorkspaceBillingDataFixture(
  overrides: Partial<WorkspaceBillingDataFixture> = {}
): WorkspaceBillingDataFixture {
  const plan = overrides.plan ?? FREE_PLAN_FIXTURE;
  return {
    planId: overrides.planId ?? plan.id,
    plan,
    entitlements: overrides.entitlements ?? plan.entitlements,
    subscription: overrides.subscription ?? null,
    scheduledTargetPlanId: overrides.scheduledTargetPlanId ?? null,
    memberCount: overrides.memberCount ?? 0,
  };
}
