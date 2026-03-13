# Plan Model Refactor Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Align internal `PlanId` with Better Auth's plan names (`'starter' | 'pro'`), eliminating `normalizePlanId`, `PLAN_GROUP`, and the monthly/annual variant split.

**Architecture:** Collapse `'pro-monthly'`/`'pro-annual'` into a single `'pro'` plan with nested `pricing.monthly`/`pricing.annual`. Billing interval becomes a UI concern (which price to display), not a plan identity concern. All files that reference `PlanId`, `Plan`, or the removed helpers must be updated.

**Tech Stack:** TypeScript, Vitest, TanStack Start (server functions), TanStack Query, React, Zod v4

**Design doc:** `docs/plans/2026-03-12-plan-model-refactor-design.md`

---

### Task 1: Rewrite `plans.ts` — types, data, and helpers

This is the foundation. Everything else depends on this.

**Files:**

- Modify: `src/billing/plans.ts`
- Modify: `src/billing/plans.test.ts`

**Step 1: Write failing tests**

Replace `src/billing/plans.test.ts` entirely:

```ts
import { describe, expect, it } from 'vitest';
import {
  FREE_PLAN_ID,
  PLANS,
  formatPlanPrice,
  getFreePlan,
  getHighestTierPlanId,
  getPlanById,
  getPlanFeatures,
  getPlanLimitsForPlanId,
  getUpgradePlan,
  resolveUserPlanId,
} from '@/billing/plans';

describe('plans', () => {
  it('exports exactly two plans', () => {
    expect(PLANS).toHaveLength(2);
  });

  it('has exactly one free-tier plan (tier 0)', () => {
    const freePlans = PLANS.filter((p) => p.tier === 0);
    expect(freePlans).toHaveLength(1);
    expect(freePlans[0].id).toBe(FREE_PLAN_ID);
    expect(freePlans[0].pricing).toBeNull();
  });

  it('getPlanById returns the correct plan', () => {
    const plan = getPlanById('starter');
    expect(plan).toBeDefined();
    expect(plan!.name).toBe('Starter');
  });

  it('getPlanById returns undefined for unknown id', () => {
    expect(getPlanById('nonexistent' as never)).toBeUndefined();
  });

  it('getFreePlan returns the starter plan', () => {
    const free = getFreePlan();
    expect(free.id).toBe(FREE_PLAN_ID);
    expect(free.pricing).toBeNull();
  });

  it('getPlanLimitsForPlanId returns correct limits for starter', () => {
    const limits = getPlanLimitsForPlanId('starter');
    expect(limits.maxWorkspaces).toBe(1);
    expect(limits.maxMembersPerWorkspace).toBe(1);
  });

  it('getPlanLimitsForPlanId returns higher limits for pro', () => {
    const limits = getPlanLimitsForPlanId('pro');
    expect(limits.maxWorkspaces).toBeGreaterThan(1);
    expect(limits.maxMembersPerWorkspace).toBeGreaterThan(1);
  });

  it('getPlanLimitsForPlanId falls back to starter for unknown plan', () => {
    const limits = getPlanLimitsForPlanId('nonexistent' as never);
    expect(limits.maxWorkspaces).toBe(1);
  });

  it('pro plan has a higher tier than starter', () => {
    const starter = getPlanById('starter')!;
    const pro = getPlanById('pro')!;
    expect(pro.tier).toBeGreaterThan(starter.tier);
  });

  it('getHighestTierPlanId picks the highest tier', () => {
    expect(getHighestTierPlanId(['starter', 'pro'])).toBe('pro');
  });

  it('getHighestTierPlanId falls back to free for empty list', () => {
    expect(getHighestTierPlanId([])).toBe(FREE_PLAN_ID);
  });

  it('getHighestTierPlanId falls back to free for unknown IDs', () => {
    expect(getHighestTierPlanId(['unknown'])).toBe(FREE_PLAN_ID);
  });
});

describe('getUpgradePlan', () => {
  it('returns next tier plan for starter', () => {
    const starter = getPlanById('starter')!;
    const upgrade = getUpgradePlan(starter);
    expect(upgrade).toBeDefined();
    expect(upgrade!.id).toBe('pro');
  });

  it('returns null for highest tier plan', () => {
    const pro = getPlanById('pro')!;
    const upgrade = getUpgradePlan(pro);
    expect(upgrade).toBeNull();
  });
});

describe('resolveUserPlanId', () => {
  it('returns free plan for empty subscriptions', () => {
    expect(resolveUserPlanId([])).toBe(FREE_PLAN_ID);
  });

  it('returns free plan when no subscriptions are active or trialing', () => {
    expect(
      resolveUserPlanId([
        { plan: 'pro', status: 'canceled' },
        { plan: 'pro', status: 'past_due' },
      ]),
    ).toBe(FREE_PLAN_ID);
  });

  it('resolves active pro subscription', () => {
    expect(resolveUserPlanId([{ plan: 'pro', status: 'active' }])).toBe('pro');
  });

  it('returns the plan ID for a trialing subscription', () => {
    expect(resolveUserPlanId([{ plan: 'pro', status: 'trialing' }])).toBe(
      'pro',
    );
  });

  it('picks the highest tier when multiple active subscriptions exist', () => {
    expect(
      resolveUserPlanId([
        { plan: 'starter', status: 'active' },
        { plan: 'pro', status: 'active' },
      ]),
    ).toBe('pro');
  });

  it('ignores non-active subscriptions when picking highest tier', () => {
    expect(
      resolveUserPlanId([
        { plan: 'pro', status: 'canceled' },
        { plan: 'starter', status: 'active' },
      ]),
    ).toBe('starter');
  });

  it('falls back to free plan for unknown plan IDs', () => {
    expect(
      resolveUserPlanId([{ plan: 'unknown-plan', status: 'active' }]),
    ).toBe(FREE_PLAN_ID);
  });
});

describe('formatPlanPrice', () => {
  it('returns empty string for free plans', () => {
    const freePlan = getPlanById('starter')!;
    expect(formatPlanPrice(freePlan, false)).toBe('');
  });

  it('formats monthly price', () => {
    const pro = getPlanById('pro')!;
    const price = formatPlanPrice(pro, false);
    expect(price).toMatch(/\$49\/mo$/);
  });

  it('formats annual price as monthly equivalent', () => {
    const pro = getPlanById('pro')!;
    const price = formatPlanPrice(pro, true);
    expect(price).toMatch(/\/mo$/);
    expect(price).toContain('$');
  });
});

describe('getPlanFeatures', () => {
  it('returns base features for monthly', () => {
    const pro = getPlanById('pro')!;
    const features = getPlanFeatures(pro, false);
    expect(features).toContain('Priority support');
    expect(features).not.toContain('2 months free');
  });

  it('returns base + bonus features for annual', () => {
    const pro = getPlanById('pro')!;
    const features = getPlanFeatures(pro, true);
    expect(features).toContain('Priority support');
    expect(features).toContain('2 months free');
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `bun test src/billing/plans.test.ts`
Expected: FAIL — new exports don't exist yet

**Step 3: Rewrite `plans.ts`**

Replace `src/billing/plans.ts` entirely:

```ts
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

/**
 * Returns a human-readable monthly price string for a plan.
 * For annual pricing, normalizes to the equivalent monthly price.
 */
export function formatPlanPrice(plan: Plan, annual: boolean): string {
  if (!plan.pricing) return '';
  const p = annual ? plan.pricing.annual : plan.pricing.monthly;
  const monthly = annual ? p.price / 12 / 100 : p.price / 100;
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
```

**Step 4: Run tests to verify they pass**

Run: `bun test src/billing/plans.test.ts`
Expected: ALL PASS

**Step 5: Commit**

```bash
git add src/billing/plans.ts src/billing/plans.test.ts
git commit -m "refactor(billing): collapse plan model to match Better Auth — eliminate normalizePlanId"
```

---

### Task 2: Update `billing.server.ts`

Remove `normalizePlanId` usage. The DB `plan` column already stores `'pro'` which is now a valid `PlanId`.

**Files:**

- Modify: `src/billing/billing.server.ts`

**Step 1: Update imports (line 5-10)**

Remove `normalizePlanId` from the import. Keep `getPlanLimitsForPlanId` and `resolveUserPlanId`.

**Step 2: Simplify `getUserSubscriptionDetails` (line 133-136)**

Replace:

```ts
normalizePlanId(r.plan) === planId,
```

With:

```ts
r.plan === planId,
```

**Step 3: Run typecheck**

Run: `bun run typecheck`
Expected: No errors

**Step 4: Commit**

```bash
git add src/billing/billing.server.ts
git commit -m "refactor(billing): remove normalizePlanId from billing.server.ts"
```

---

### Task 3: Update `billing.functions.ts`

Update checkout flow, remove `PLAN_GROUP`, simplify `checkPlanLimit`.

**Files:**

- Modify: `src/billing/billing.functions.ts`

**Step 1: Update imports (lines 15-24)**

Remove: `PLAN_GROUP`
Keep: `PLANS`, `getFreePlan`, `getPlanById`, `getPlanLimitsForPlanId`, `getUpgradePlan`, `resolveUserPlanId`
Type import: keep `PlanId`

**Step 2: Update `upgradeInput` zod schema (lines 62-66)**

Replace:

```ts
const VALID_PLAN_IDS = PLANS.map((p) => p.id) as [PlanId, ...Array<PlanId>];

const upgradeInput = z.object({
  planId: z.enum(VALID_PLAN_IDS),
});
```

With:

```ts
const VALID_PLAN_IDS = PLANS.map((p) => p.id) as [PlanId, ...Array<PlanId>];

const upgradeInput = z.object({
  planId: z.enum(VALID_PLAN_IDS),
  annual: z.boolean(),
});
```

**Step 3: Update `createCheckoutSession` handler (lines 73-95)**

Replace the handler body:

```ts
export const createCheckoutSession = createServerFn()
  .inputValidator(upgradeInput)
  .handler(async ({ data }) => {
    const headers = getRequestHeaders();
    await requireVerifiedSession();

    // PlanId maps 1:1 to Better Auth's plan name — no translation needed.
    const result = await auth.api.upgradeSubscription({
      headers,
      body: {
        plan: data.planId,
        annual: data.annual,
        successUrl: `${process.env.BETTER_AUTH_URL}/billing?success=true`,
        cancelUrl: `${process.env.BETTER_AUTH_URL}/billing`,
      },
    });

    return { url: result.url, redirect: result.redirect };
  });
```

**Step 4: Update `checkPlanLimit` — remove `annual` param from `getUpgradePlan` calls (lines 187, 219)**

Replace:

```ts
const upgradePlan = plan ? getUpgradePlan(plan, false) : null;
```

With:

```ts
const upgradePlan = plan ? getUpgradePlan(plan) : null;
```

Do this for both occurrences (line 187 for workspace limits, line 219 for member limits).

**Step 5: Run typecheck**

Run: `bun run typecheck`
Expected: Errors in `billing-page.tsx` and `use-upgrade-prompt.ts` (they still pass old args). Fixed in Tasks 4-5.

**Step 6: Commit**

```bash
git add src/billing/billing.functions.ts
git commit -m "refactor(billing): simplify checkout flow — planId + annual maps directly to Better Auth"
```

---

### Task 4: Update `billing-page.tsx`

Adapt to new `getUpgradePlan` signature and new `createCheckoutSession` input.

**Files:**

- Modify: `src/components/billing/billing-page.tsx`

**Step 1: Update `getUpgradePlan` call (line 78)**

Replace:

```ts
const upgradePlan = getUpgradePlan(currentPlan, isAnnual);
```

With:

```ts
const upgradePlan = getUpgradePlan(currentPlan);
```

**Step 2: Update `upgradeMutation` (lines 51-61)**

Replace:

```ts
const upgradeMutation = useMutation({
  mutationFn: (planId: PlanId) => createCheckoutSession({ data: { planId } }),
```

With:

```ts
const upgradeMutation = useMutation({
  mutationFn: ({ planId, annual }: { planId: PlanId; annual: boolean }) =>
    createCheckoutSession({ data: { planId, annual } }),
```

**Step 3: Update `onUpgrade` prop (line 102)**

Replace:

```ts
onUpgrade={(id) => upgradeMutation.mutate(id)}
```

With:

```ts
onUpgrade={(id) => upgradeMutation.mutate({ planId: id, annual: isAnnual })}
```

**Step 4: Run typecheck**

Run: `bun run typecheck`
Expected: Errors in `billing-plan-cards.tsx` and `upgrade-prompt-dialog.tsx` (they still use old `formatPrice`). Fixed in Task 6.

**Step 5: Commit**

```bash
git add src/components/billing/billing-page.tsx
git commit -m "refactor(billing): update billing page for collapsed plan model"
```

---

### Task 5: Update `use-upgrade-prompt.ts`

Remove `getUpgradePlanVariant`, `PLAN_GROUP`, and `PLANS` imports. Simplify mutation.

**Files:**

- Modify: `src/hooks/use-upgrade-prompt.ts`

**Step 1: Rewrite the hook**

Replace `src/hooks/use-upgrade-prompt.ts` entirely:

```ts
import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { createCheckoutSession } from '@/billing/billing.functions';
import type { Plan, PlanId } from '@/billing/plans';

interface UpgradePromptState {
  open: boolean;
  title: string;
  description: string;
  /** The plan to offer. null = highest tier, show limit-reached message. */
  upgradePlan: Plan | null;
}

const INITIAL_STATE: UpgradePromptState = {
  open: false,
  title: '',
  description: '',
  upgradePlan: null,
};

/**
 * Encapsulates upgrade prompt dialog state, billing interval toggle,
 * and Stripe checkout mutation. Reusable across any component that
 * gates actions behind plan limits.
 *
 * When upgradePlan is null (highest tier), the dialog shows a
 * "limit reached" message instead of a checkout offer.
 */
export function useUpgradePrompt() {
  const [prompt, setPrompt] = useState<UpgradePromptState>(INITIAL_STATE);
  const [isAnnual, setIsAnnual] = useState(false);

  const upgradeMutation = useMutation({
    mutationFn: ({ planId, annual }: { planId: PlanId; annual: boolean }) =>
      createCheckoutSession({ data: { planId, annual } }),
    onSuccess: (result) => {
      if (result.url) {
        window.location.href = result.url;
      }
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to start checkout.');
    },
  });

  const show = (
    title: string,
    description: string,
    upgradePlan: Plan | null,
  ) => {
    setPrompt({ open: true, title, description, upgradePlan });
  };

  const dialogProps = {
    open: prompt.open,
    onOpenChange: (open: boolean) => setPrompt((prev) => ({ ...prev, open })),
    title: prompt.title,
    description: prompt.description,
    upgradePlan: prompt.upgradePlan,
    isUpgrading: upgradeMutation.isPending,
    onUpgrade: () => {
      if (prompt.upgradePlan) {
        upgradeMutation.mutate({
          planId: prompt.upgradePlan.id,
          annual: isAnnual,
        });
      }
    },
    isAnnual,
    onToggleInterval: setIsAnnual,
  };

  return { show, dialogProps };
}
```

Key simplifications:

- Removed `getUpgradePlanVariant()` entirely (was 11 lines)
- Removed `PLANS` and `PLAN_GROUP` imports
- `dialogProps.upgradePlan` passes the plan directly (no variant resolution)
- Mutation sends `{ planId, annual }` directly

**Step 2: Run typecheck**

Run: `bun run typecheck`
Expected: Still errors in UI components for `formatPrice`. Fixed in Task 6.

**Step 3: Commit**

```bash
git add src/hooks/use-upgrade-prompt.ts
git commit -m "refactor(billing): simplify useUpgradePrompt — remove variant resolution"
```

---

### Task 6: Update UI components — `billing-plan-cards.tsx` and `upgrade-prompt-dialog.tsx`

Update `formatPrice` → `formatPlanPrice`, render features with `getPlanFeatures`, and adapt to the new `Plan` interface (no more `plan.price` or `plan.interval`).

**Files:**

- Modify: `src/components/billing/billing-plan-cards.tsx`
- Modify: `src/components/billing/upgrade-prompt-dialog.tsx`

**Step 1: Update `billing-plan-cards.tsx`**

Update imports (line 12-13):

```ts
import { formatPlanPrice, getPlanFeatures } from '@/billing/plans';
import type { Plan, PlanId } from '@/billing/plans';
```

Update current plan price display (lines 55-59):
Replace:

```tsx
<p className="text-muted-foreground text-sm">
  {currentPlan.price === 0 ? 'Free forever' : formatPrice(currentPlan)}
</p>
```

With:

```tsx
<p className="text-muted-foreground text-sm">
  {!currentPlan.pricing ? 'Free forever' : formatPlanPrice(currentPlan, false)}
</p>
```

Update current plan features (lines 66-71). Replace `currentPlan.features` with `currentPlan.features` (no change needed — current plan shows base features).

Update current plan "has pricing" check (line 74):
Replace:

```tsx
{currentPlan.price > 0 && (
```

With:

```tsx
{currentPlan.pricing && (
```

Update upgrade plan price display (lines 97-101):
Replace:

```tsx
{
  upgradePlan.price > 0 && (
    <p className="text-sm font-medium">{formatPrice(upgradePlan)}</p>
  );
}
```

With:

```tsx
{
  upgradePlan.pricing && (
    <p className="text-sm font-medium">
      {formatPlanPrice(upgradePlan, isAnnual)}
    </p>
  );
}
```

Update upgrade plan features (lines 123-130):
Replace `upgradePlan.features` with `getPlanFeatures(upgradePlan, isAnnual)`.

**Step 2: Update `upgrade-prompt-dialog.tsx`**

Update imports (line 11-12):

```ts
import { formatPlanPrice, getPlanFeatures } from '@/billing/plans';
import type { Plan } from '@/billing/plans';
```

Update price display (lines 61-65):
Replace:

```tsx
{
  formatPrice(upgradePlan) && (
    <span className="text-muted-foreground text-sm">
      {formatPrice(upgradePlan)}
    </span>
  );
}
```

With:

```tsx
{
  upgradePlan.pricing && (
    <span className="text-muted-foreground text-sm">
      {formatPlanPrice(upgradePlan, isAnnual)}
    </span>
  );
}
```

Update features (lines 91-100):
Replace `upgradePlan.features` with `getPlanFeatures(upgradePlan, isAnnual)`.

**Step 3: Run typecheck**

Run: `bun run typecheck`
Expected: No errors

**Step 4: Run tests**

Run: `bun test`
Expected: All billing tests pass

**Step 5: Commit**

```bash
git add src/components/billing/billing-plan-cards.tsx src/components/billing/upgrade-prompt-dialog.tsx
git commit -m "refactor(billing): update UI components for collapsed plan model with formatPlanPrice"
```

---

### Task 7: Final verification

**Step 1: Run full checks**

Run: `bun run check`
Expected: No type errors, no lint errors

**Step 2: Run test suite**

Run: `bun test`
Expected: All tests pass

**Step 3: Verify no leftover references to removed code**

Search for any remaining references to removed identifiers:

```bash
rg "normalizePlanId|PLAN_GROUP|PlanGroup|getPlanByStripePriceId|pro-monthly|pro-annual" src/ --type ts --type tsx
```

Expected: No matches (except possibly in design/plan docs)

**Step 4: Manual browser verification**

Test at `http://localhost:3000`:

1. Starter user billing page: shows "Starter / Free forever" + Pro upgrade card
2. Pro subscriber billing page: shows "Pro" current plan + "Need more?" card
3. Toggle monthly/annual on upgrade card: price changes, "2 months free" appears for annual
4. Starter user hits workspace limit: upgrade prompt shows Pro offer
5. Pro subscriber hits workspace limit: upgrade prompt shows limit-reached message

**Step 5: Commit any fixes from verification**
