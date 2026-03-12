// ────────────────────────────────────────────────────────────────────────────
// Plan configuration — single source of truth for subscription tiers.
//
// Plan IDs match Better Auth's plan names exactly (e.g. 'starter', 'pro').
// Monthly vs annual is a pricing dimension, not a plan identity.
//
// To add a new plan:
//   1. Add its ID to the PlanId union.
//   2. Add an entry to the PLANS array.
//   3. Create the corresponding product + prices in Stripe Dashboard.
//   4. Set the stripe price IDs in the pricing field.
//   5. Run the app — limit enforcement and UI pick up the new plan automatically.
//
// To add a new limit dimension:
//   1. Add the field to PlanLimits.
//   2. Populate it for every plan in the PLANS array.
//   3. Add enforcement in the appropriate org hook (auth.server.ts).
// ────────────────────────────────────────────────────────────────────────────

export type PlanId = 'starter' | 'pro';

export interface PlanLimits {
  /** Maximum workspaces the user can own. -1 = unlimited. */
  maxWorkspaces: number;
  /** Maximum members per workspace. -1 = unlimited. */
  maxMembersPerWorkspace: number;
}

export interface PlanPricing {
  /** Stripe price ID (price_xxx). */
  stripePriceId: string | null;
  /** Price in cents. */
  price: number;
}

export interface Plan {
  id: PlanId;
  /** Display name shown in UI (e.g. "Starter", "Pro"). */
  name: string;
  /** Explicit tier rank for comparing plans. Higher = more permissive. */
  tier: number;
  /** Monthly and annual pricing. null for the free tier. */
  pricing: { monthly: PlanPricing; annual: PlanPricing } | null;
  limits: PlanLimits;
  /** Feature bullets shown on the billing page. */
  features: Array<string>;
  /** Extra feature bullets shown only for the annual variant. */
  annualBonusFeatures: Array<string>;
}

/** Canonical plan ID for the free tier. */
export const FREE_PLAN_ID: PlanId = 'starter';

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
    pricing: null,
    limits: STARTER_LIMITS,
    features: ['1 personal workspace', '1 member'],
    annualBonusFeatures: [],
  },
  {
    id: 'pro',
    name: 'Pro',
    tier: 1,
    pricing: {
      monthly: {
        stripePriceId: process.env.STRIPE_PRO_MONTHLY_PRICE_ID ?? null,
        price: 49_00,
      },
      annual: {
        stripePriceId: process.env.STRIPE_PRO_ANNUAL_PRICE_ID ?? null,
        price: 490_00,
      },
    },
    limits: PRO_LIMITS,
    features: [
      'Up to 5 workspaces',
      'Up to 5 members per workspace',
      'Priority support',
    ],
    annualBonusFeatures: ['2 months free'],
  },
] as const;

// ── Helpers ────────────────────────────────────────────────────────────────

export function getPlanById(id: PlanId): Plan | undefined {
  return PLANS.find((p) => p.id === id);
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

// ── Pricing helpers ──────────────────────────────────────────────────────

const CURRENCY_FORMAT = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 0,
});

const MONTHS_PER_YEAR = 12;

/**
 * Returns a human-readable monthly price string for a plan.
 * For annual pricing, normalizes to the equivalent monthly price.
 */
export function formatPlanPrice(plan: Plan, annual: boolean): string {
  if (!plan.pricing) return '';
  const p = annual ? plan.pricing.annual : plan.pricing.monthly;
  const monthly = annual ? p.price / MONTHS_PER_YEAR / 100 : p.price / 100;
  return `${CURRENCY_FORMAT.format(monthly)}/mo`;
}

/**
 * Returns the feature list for a plan, including annual bonus features
 * when the annual flag is set.
 */
export function getPlanFeatures(plan: Plan, annual: boolean): Array<string> {
  if (!annual || plan.annualBonusFeatures.length === 0) return plan.features;
  return [...plan.features, ...plan.annualBonusFeatures];
}

// ── Tier resolution ──────────────────────────────────────────────────────

/**
 * Given multiple plan IDs (e.g. from multiple active subscriptions),
 * returns the one with the highest tier rank.
 * Falls back to FREE_PLAN_ID if the list is empty or all IDs are unknown.
 */
export function getHighestTierPlanId(planIds: Array<string>): PlanId {
  let best: Plan | undefined;
  for (const id of planIds) {
    const plan = PLANS.find((p) => p.id === id);
    if (plan && (!best || plan.tier > best.tier)) {
      best = plan;
    }
  }
  return best?.id ?? FREE_PLAN_ID;
}

/**
 * Returns the next upgrade plan for a given plan (next tier up), or null
 * if the user is already on the highest tier.
 */
export function getUpgradePlan(currentPlan: Plan): Plan | null {
  const higherTierPlans = PLANS.filter((p) => p.tier > currentPlan.tier).sort(
    (a, b) => a.tier - b.tier,
  );
  if (higherTierPlans.length === 0) return null;
  return higherTierPlans[0];
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
