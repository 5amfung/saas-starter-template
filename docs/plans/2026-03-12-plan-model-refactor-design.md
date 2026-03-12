# Plan Model Refactor — Eliminate normalizePlanId

**Date:** 2026-03-12
**Status:** Approved

## Problem

The app maintains three plan IDs (`'starter'`, `'pro-monthly'`, `'pro-annual'`) while Better Auth's Stripe plugin stores a single plan name (`'pro'`) in the database. This mismatch forces a `normalizePlanId` mapping layer (`'pro'` → `'pro-monthly'`) and a `PLAN_GROUP` reverse mapping. Monthly vs annual is a billing interval, not a different plan — the limits, tier, and name are identical.

## Design

### Plan data model

`PlanId` becomes `'starter' | 'pro'`, matching Better Auth and Stripe exactly.

```ts
type PlanId = 'starter' | 'pro';

interface PlanPricing {
  stripePriceId: string | null;
  price: number; // cents
}

interface Plan {
  id: PlanId;
  name: string;
  tier: number;
  pricing: {
    monthly: PlanPricing;
    annual: PlanPricing;
  } | null; // null for free tier
  limits: PlanLimits;
  features: string[];
  annualBonusFeatures: string[]; // e.g. ["2 months free"]
}
```

`PLANS` shrinks from 3 entries to 2. The billing interval is a UI/pricing concern, not a plan identity concern.

### Eliminated code

- `PLAN_GROUP` — no longer needed (no monthly/annual variants to group)
- `SUBSCRIPTION_PLAN_MAP` — no longer needed (`'pro'` is a valid `PlanId`)
- `normalizePlanId()` — no longer needed
- `getPlanByStripePriceId()` — no callers after refactor
- `getUpgradePlanVariant()` in `useUpgradePrompt` — no variant resolution needed

### Simplified code

- `getUpgradePlan(plan)` — no `annual` parameter; returns next tier or null
- `getHighestTierPlanId()` — no `normalizePlanId` call needed
- `useUpgradePrompt` — mutation sends `{ planId, annual }` directly
- `createCheckoutSession` — input becomes `{ planId: PlanId, annual: boolean }`, maps 1:1 to Better Auth's `upgradeSubscription({ plan, annual })`

### File changes

| File                                    | Change                                                                                                                                                             |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `plans.ts`                              | New `Plan` interface, 2-entry `PLANS` array. Remove `PLAN_GROUP`, `SUBSCRIPTION_PLAN_MAP`, `normalizePlanId`, `getPlanByStripePriceId`. Simplify `getUpgradePlan`. |
| `plans.test.ts`                         | Update tests for `'pro'` IDs. Remove `normalizePlanId` tests. Update `getUpgradePlan` tests.                                                                       |
| `billing.server.ts`                     | Remove `normalizePlanId` import and usage in `getUserSubscriptionDetails`.                                                                                         |
| `billing.functions.ts`                  | `createCheckoutSession` takes `{ planId, annual }`. Simplify `checkPlanLimit`. Dynamic zod validates `['starter', 'pro']`.                                         |
| `billing-page.tsx`                      | `getUpgradePlan(plan)` (no annual param). `upgradeMutation` sends `{ planId, annual }`.                                                                            |
| `billing-plan-cards.tsx`                | `formatPrice(plan, annual)`. Render `features` + conditional `annualBonusFeatures`.                                                                                |
| `upgrade-prompt-dialog.tsx`             | `formatPrice(plan, annual)`. Render features + conditional bonus.                                                                                                  |
| `use-upgrade-prompt.ts`                 | Remove `getUpgradePlanVariant`. Remove `PLAN_GROUP`/`PLANS` imports. Mutation sends `{ planId, annual }`.                                                          |
| `workspace-switcher.tsx`, `members.tsx` | No change.                                                                                                                                                         |
| `auth.server.ts`                        | No change — org hooks already work with the simplified `PlanId`.                                                                                                   |

### Helper function summary

| Function                 | Change                                                             |
| ------------------------ | ------------------------------------------------------------------ |
| `getPlanById`            | No logic change (searches 2 plans instead of 3)                    |
| `getFreePlan`            | No change                                                          |
| `getPlanLimitsForPlanId` | No change                                                          |
| `getHighestTierPlanId`   | Remove `normalizePlanId` call                                      |
| `resolveUserPlanId`      | No logic change                                                    |
| `getUpgradePlan`         | Remove `annual` param and `PLAN_GROUP` variant resolution          |
| `formatPrice` (UI)       | Takes `(plan, annual)`, reads `plan.pricing?.monthly` or `.annual` |
| `normalizePlanId`        | **Removed**                                                        |
| `getPlanByStripePriceId` | **Removed**                                                        |

## UX Decisions

- "2 months free" is an `annualBonusFeatures` entry — declarative config, no UI derivation needed.
- Billing interval toggle is purely a UI concern — selects which price to display and which Stripe price to checkout with.
- No functional or visual changes to the user-facing UI.
