# Billing UX Fixes — Design

**Date:** 2026-03-12
**Status:** Approved

## Problem

Three related bugs in the billing/upgrade UX:

1. **Billing page shows wrong current plan.** The page reads `session.user.subscription` which doesn't exist on the Better Auth session object. It always falls back to `FREE_PLAN_ID`, so a paying Pro user sees "Starter / Free forever" as their current plan.

2. **Upgrade prompt offers Pro to Pro users.** `useUpgradePrompt` always creates a checkout for `pro-monthly`/`pro-annual` regardless of the user's current tier. When a Pro user hits their 5-workspace or 5-member limit, they see "Upgrade to Pro" — which is the plan they already have.

3. **No highest-tier handling.** When there's no upgrade plan available, the billing page renders a single card (upgrade card disappears), and the upgrade prompt has no concept of "you're already at the top."

## Root Cause

- The billing page assumes Better Auth's `getSession()` populates `session.user.subscription`. It does not — subscription data lives in the `subscription` table and must be queried explicitly.
- Server functions like `checkPlanLimit` correctly call `getUserActivePlanId()` via the subscription table, but the billing page and upgrade prompt bypass this.
- `UpgradePromptDialog` hardcodes `proMonthly`/`proAnnual` at module level, making it impossible to show a different tier or a "limit reached" state.

## Design

### 1. Data Layer — `getUserBillingData` server function

Create a new server function in `billing.functions.ts` that returns all billing state the client needs in one call:

```ts
getUserBillingData() → {
  planId: PlanId;
  plan: Plan;
  subscription: {
    status: string;
    periodEnd: Date | null;
    cancelAtPeriodEnd: boolean;
  } | null;
}
```

Reuses existing `getUserActivePlanId()` from `billing.server.ts`, then queries the subscription table for status/periodEnd/cancelAtPeriodEnd. Single server round-trip.

The billing page replaces the broken `session.user.subscription` cast with a `useQuery` call to `getUserBillingData`. The `normalizePlanId` dance and `as unknown` cast are eliminated.

### 2. Upgrade Prompt — tier-aware behavior

Two modes in a single dialog component:

**Upgrade available:** `checkPlanLimit` is extended to return `upgradePlan: Plan | null` — the next tier up. The dialog renders that plan's name, price, and features dynamically instead of hardcoded Pro.

**No upgrade available:** When user is on the highest tier, `checkPlanLimit` returns `upgradePlan: null`. The dialog shows a "limit reached" message — same context banner at top, but body reads "You've reached your {planName} plan limit." with a "Got it" dismiss button. No action CTA (placeholder for future "Contact us" link).

| File                                       | Change                                                                                                          |
| ------------------------------------------ | --------------------------------------------------------------------------------------------------------------- |
| `checkPlanLimit` in `billing.functions.ts` | Add `upgradePlan: Plan \| null` to return value                                                                 |
| `useUpgradePrompt` hook                    | Accept upgrade plan from `checkPlanLimit` result                                                                |
| `UpgradePromptDialog`                      | Remove hardcoded plan lookups. Accept `upgradePlan: Plan \| null` as prop. Conditional rendering based on null. |
| `members.tsx`, `workspace-switcher.tsx`    | Pass `upgradePlan` from `checkPlanLimit` result through to the hook                                             |

### 3. Billing Page — highest-tier placeholder card

When `upgradePlan` is `null`, render a placeholder card instead of nothing:

- Same `Card`/`CardHeader`/`CardContent` structure for visual consistency with the upgrade card.
- Title: "Need more?" Description: "You're on our best plan. Contact us for a custom plan."
- No action button. No billing interval toggle.
- Wording is plan-name-agnostic — works regardless of what the highest tier is called.

### 4. Future-proofing — remove hardcoded plan references

| Hardcoded reference                                                           | Fix                                                            |
| ----------------------------------------------------------------------------- | -------------------------------------------------------------- |
| `UpgradePromptDialog` lines 14-15: `proMonthly`/`proAnnual`                   | Remove. Dialog receives `upgradePlan` as prop.                 |
| `useUpgradePrompt` mutation: `annual ? 'pro-annual' : 'pro-monthly'`          | Mutation receives target plan ID from `checkPlanLimit` result. |
| `upgradeInput` zod schema: `z.enum(['starter', 'pro-monthly', 'pro-annual'])` | Validate against `PLANS.map(p => p.id)` dynamically.           |
| `billing-page.tsx` `getUpgradePlan()`                                         | Already dynamic — no change needed.                            |

**Result:** Adding a new tier requires only: (1) add entries to `PLANS` array, (2) create Stripe product/price, (3) set env var. All UI adapts automatically.

## UX Decisions

- **Highest-tier limit reached (upgrade prompt):** Message-only, no action CTA. Placeholder for future "Contact us" link.
- **Highest-tier billing page:** Two-card layout preserved. Right card becomes "Need more?" placeholder.
- **Dynamic plan names:** All user-facing text references `plan.name` not hardcoded strings.
