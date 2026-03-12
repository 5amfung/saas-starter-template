// ────────────────────────────────────────────────────────────────────────────
// Plan configuration — single source of truth for subscription tiers.
//
// To add a new plan:
//   1. Add its ID to the PlanId union.
//   2. Add an entry to the PLANS array.
//   3. Create the corresponding product + price in Stripe Dashboard.
//   4. Set the stripePriceId to the Stripe price ID (price_xxx).
//   5. Run the app — limit enforcement and UI pick up the new plan automatically.
//
// To add a new limit dimension:
//   1. Add the field to PlanLimits.
//   2. Populate it for every plan in the PLANS array.
//   3. Add enforcement in the appropriate org hook (auth.server.ts).
// ────────────────────────────────────────────────────────────────────────────

export type PlanId = 'starter' | 'pro-monthly' | 'pro-annual';

export interface PlanLimits {
  /** Maximum workspaces the user can own. -1 = unlimited. */
  maxWorkspaces: number;
  /** Maximum members per workspace. -1 = unlimited. */
  maxMembersPerWorkspace: number;
}

export interface Plan {
  id: PlanId;
  /** Display name shown in UI (e.g. "Starter", "Pro"). */
  name: string;
  /** Explicit tier rank for comparing plans. Higher = more permissive. */
  tier: number;
  /** Stripe price ID. null for the free tier. */
  stripePriceId: string | null;
  /** Price in cents. 0 for free. */
  price: number;
  /** Billing interval. null for the free tier. */
  interval: 'month' | 'year' | null;
  limits: PlanLimits;
  /** Feature bullets shown on the billing page. */
  features: Array<string>;
}

/** Canonical plan ID for the free tier. */
export const FREE_PLAN_ID: PlanId = 'starter';

/** Group name shared by monthly and annual variants of the same tier. */
export type PlanGroup = 'starter' | 'pro';

/** Map a plan ID to its group for display purposes. */
export const PLAN_GROUP: Record<PlanId, PlanGroup> = {
  starter: 'starter',
  'pro-monthly': 'pro',
  'pro-annual': 'pro',
};

const STARTER_LIMITS: PlanLimits = {
  maxWorkspaces: 1,
  maxMembersPerWorkspace: 1,
};

const PRO_LIMITS: PlanLimits = {
  maxWorkspaces: 5,
  maxMembersPerWorkspace: 5,
};

export const PLANS: ReadonlyArray<Plan> = [
  {
    id: 'starter',
    name: 'Starter',
    tier: 0,
    stripePriceId: null,
    price: 0,
    interval: null,
    limits: STARTER_LIMITS,
    features: ['1 personal workspace', '1 member'],
  },
  {
    id: 'pro-monthly',
    name: 'Pro',
    tier: 1,
    stripePriceId: process.env.STRIPE_PRO_MONTHLY_PRICE_ID ?? null,
    price: 49_00,
    interval: 'month',
    limits: PRO_LIMITS,
    features: [
      'Up to 5 workspaces',
      'Up to 5 members per workspace',
      'Priority support',
    ],
  },
  {
    id: 'pro-annual',
    name: 'Pro',
    tier: 1,
    stripePriceId: process.env.STRIPE_PRO_ANNUAL_PRICE_ID ?? null,
    price: 490_00,
    interval: 'year',
    limits: PRO_LIMITS,
    features: [
      'Up to 5 workspaces',
      'Up to 5 members per workspace',
      'Priority support',
      '2 months free',
    ],
  },
] as const;

// ── Subscription plan name mapping ────────────────────────────────────────
// Better Auth stores subscriptions with short plan names (e.g. 'pro').
// Map those to our internal PlanId variants for display and limit lookups.

const SUBSCRIPTION_PLAN_MAP: Record<string, PlanId> = {
  pro: 'pro-monthly',
};

/** Normalizes a Better Auth subscription plan name to our internal PlanId. */
export function normalizePlanId(planName: string): PlanId {
  return SUBSCRIPTION_PLAN_MAP[planName] ?? (planName as PlanId);
}

// ── Helpers ────────────────────────────────────────────────────────────────

export function getPlanById(id: PlanId): Plan | undefined {
  return PLANS.find((p) => p.id === id);
}

export function getPlanByStripePriceId(priceId: string): Plan | undefined {
  return PLANS.find((p) => p.stripePriceId === priceId);
}

export function getFreePlan(): Plan {
  const plan = getPlanById(FREE_PLAN_ID);
  if (!plan) throw new Error('Free plan is not configured.');
  return plan;
}

/**
 * Returns the plan limits for a given plan ID.
 * Falls back to the free plan limits if the plan ID is unknown.
 */
export function getPlanLimitsForPlanId(planId: string): PlanLimits {
  const plan = PLANS.find((p) => p.id === planId);
  return plan?.limits ?? getFreePlan().limits;
}

/**
 * Given multiple plan IDs (e.g. from multiple active subscriptions),
 * returns the one with the highest tier rank.
 * Falls back to FREE_PLAN_ID if the list is empty or all IDs are unknown.
 */
export function getHighestTierPlanId(planIds: Array<string>): PlanId {
  let best: Plan | undefined;
  for (const rawId of planIds) {
    const id = normalizePlanId(rawId);
    const plan = PLANS.find((p) => p.id === id);
    if (plan && (!best || plan.tier > best.tier)) {
      best = plan;
    }
  }
  return best?.id ?? FREE_PLAN_ID;
}

/**
 * Resolves a user's effective plan from a list of subscriptions.
 * Filters to active/trialing subscriptions, then picks the highest tier.
 * Falls back to FREE_PLAN_ID if no active subscriptions exist.
 *
 * Pure function — no auth or DB dependency. Safe to import from auth.server.ts
 * org hooks without circular dependency issues.
 */
export function resolveUserPlanId(
  subscriptions: ReadonlyArray<{ plan: string; status: string }>,
): PlanId {
  const activePlans = subscriptions
    .filter((s) => s.status === 'active' || s.status === 'trialing')
    .map((s) => s.plan);

  if (activePlans.length === 0) return FREE_PLAN_ID;
  return getHighestTierPlanId(activePlans);
}
