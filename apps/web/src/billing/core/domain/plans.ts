import type { Entitlements } from './entitlements';

export type {
  Entitlements,
  EntitlementOverrides,
  LimitKey,
  FeatureKey,
  QuotaKey,
  NumericEntitlementKey,
  EntitlementMeta,
  NumericEntitlementMeta,
  CheckLimitResult,
  NumericChange,
  EntitlementDiff,
} from './entitlements';

export {
  UNLIMITED,
  FEATURE_METADATA,
  LIMIT_METADATA,
  QUOTA_METADATA,
  resolveEntitlements,
  checkLimit,
  hasFeature,
  computeEntitlementDiff,
  formatEntitlementValue,
  describeEntitlements,
} from './entitlements';

export type PlanId = 'free' | 'starter' | 'pro' | 'enterprise';

export interface PlanPricing {
  /** Price in cents. */
  price: number;
}

export interface PlanDefinition {
  id: PlanId;
  /** Display name shown in UI (e.g. "Starter", "Pro"). */
  name: string;
  /** Explicit tier rank for comparing plans. Higher = more permissive. */
  tier: number;
  /** Monthly and annual pricing. null for the free tier and enterprise (custom pricing). */
  pricing: { monthly: PlanPricing; annual: PlanPricing } | null;
  /** Full entitlement set for this plan. */
  entitlements: Entitlements;
  /** Whether this plan can be purchased via Stripe checkout. */
  stripeEnabled: boolean;
  /** Whether this plan requires a sales-driven enterprise agreement. */
  isEnterprise: boolean;
}

/** Canonical plan ID for the free tier. */
export const FREE_PLAN_ID: PlanId = 'free';

const FREE_ENTITLEMENTS: Entitlements = {
  limits: { members: 1, projects: 1, apiKeys: 0 },
  features: {
    sso: false,
    auditLogs: false,
    apiAccess: false,
    prioritySupport: false,
  },
  quotas: { storageGb: 1, apiCallsMonthly: 0 },
};

const STARTER_ENTITLEMENTS: Entitlements = {
  limits: { members: 5, projects: 5, apiKeys: 0 },
  features: {
    sso: false,
    auditLogs: false,
    apiAccess: false,
    prioritySupport: false,
  },
  quotas: { storageGb: 10, apiCallsMonthly: 0 },
};

const PRO_ENTITLEMENTS: Entitlements = {
  limits: { members: 25, projects: 100, apiKeys: 5 },
  features: {
    sso: false,
    auditLogs: true,
    apiAccess: true,
    prioritySupport: true,
  },
  quotas: { storageGb: 50, apiCallsMonthly: 1000 },
};

const ENTERPRISE_ENTITLEMENTS: Entitlements = {
  limits: { members: -1, projects: -1, apiKeys: -1 },
  features: {
    sso: true,
    auditLogs: true,
    apiAccess: true,
    prioritySupport: true,
  },
  quotas: { storageGb: -1, apiCallsMonthly: -1 },
};

export const PLANS: ReadonlyArray<PlanDefinition> = [
  {
    id: 'free',
    name: 'Free',
    tier: 0,
    pricing: null,
    entitlements: FREE_ENTITLEMENTS,
    stripeEnabled: false,
    isEnterprise: false,
  },
  {
    id: 'starter',
    name: 'Starter',
    tier: 1,
    pricing: {
      monthly: { price: 5_00 },
      annual: { price: 50_00 },
    },
    entitlements: STARTER_ENTITLEMENTS,
    stripeEnabled: true,
    isEnterprise: false,
  },
  {
    id: 'pro',
    name: 'Pro',
    tier: 2,
    pricing: {
      monthly: { price: 49_00 },
      annual: { price: 490_00 },
    },
    entitlements: PRO_ENTITLEMENTS,
    stripeEnabled: true,
    isEnterprise: false,
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    tier: 3,
    pricing: null,
    entitlements: ENTERPRISE_ENTITLEMENTS,
    stripeEnabled: true,
    isEnterprise: true,
  },
];

export function getPlanById(id: PlanId): PlanDefinition | undefined {
  return PLANS.find((p) => p.id === id);
}

export function getFreePlan(): PlanDefinition {
  const plan = getPlanById(FREE_PLAN_ID);
  if (!plan) throw new Error('Free plan is not configured.');
  return plan;
}

const CURRENCY_FORMAT = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 0,
});

const MONTHS_PER_YEAR = 12;

export function formatPlanPrice(plan: PlanDefinition, annual: boolean): string {
  if (!plan.pricing) return '';
  const p = annual ? plan.pricing.annual : plan.pricing.monthly;
  const monthly = annual ? p.price / MONTHS_PER_YEAR / 100 : p.price / 100;
  return `${CURRENCY_FORMAT.format(monthly)}/mo`;
}

/**
 * Given multiple plan IDs (e.g. from multiple active subscriptions),
 * returns the one with the highest tier rank.
 * Falls back to FREE_PLAN_ID if the list is empty or all IDs are unknown.
 */
export function getHighestTierPlanId(planIds: Array<string>): PlanId {
  let best: PlanDefinition | undefined;
  for (const id of planIds) {
    const plan = PLANS.find((p) => p.id === id);
    if (plan && (!best || plan.tier > best.tier)) {
      best = plan;
    }
  }
  return best?.id ?? FREE_PLAN_ID;
}

/**
 * Returns all plans above the current plan's tier, sorted by tier ascending.
 */
export function getUpgradePlans(
  currentPlan: PlanDefinition
): Array<PlanDefinition> {
  return PLANS.filter((p) => p.tier > currentPlan.tier).sort(
    (a, b) => a.tier - b.tier
  );
}

export function getUpgradePlan(
  currentPlan: PlanDefinition
): PlanDefinition | null {
  return getUpgradePlans(currentPlan)[0] ?? null;
}

export {
  getPlanAction,
  getDowngradePlans,
  computePlanDiff,
  PLAN_ACTION_CONFIG,
} from './plan-actions';
export type { PlanAction, PlanDiff, LimitChange } from './plan-actions';

/**
 * Resolves a workspace's effective plan from a list of subscriptions.
 * Filters to active/trialing subscriptions, then picks the highest tier.
 * Falls back to FREE_PLAN_ID if no active subscriptions exist.
 */
export function resolveWorkspacePlanId(
  subscriptions: ReadonlyArray<{ plan: string; status: string }>
): PlanId {
  const activePlans = subscriptions
    .filter((s) => s.status === 'active' || s.status === 'trialing')
    .map((s) => s.plan);

  if (activePlans.length === 0) return FREE_PLAN_ID;
  return getHighestTierPlanId(activePlans);
}
