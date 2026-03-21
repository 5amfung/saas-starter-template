# Billing Page Vertical Layout Redesign

## Summary

Redesign the billing page plan cards from a horizontal 2-column grid to a vertical single-column stack. Show all available upgrade plans (not just the next tier), each as its own full-width card with an independent billing toggle.

## Current State

- `BillingPlanCards` renders a 2-column grid (`grid-cols-1 md:grid-cols-2`).
- Left column: current plan card.
- Right column: single next-tier upgrade card (via `getUpgradePlan()`), or a "Custom plan" card if on the highest tier.
- Only the immediate next upgrade plan is shown.

## Proposed Design

### Layout

- Replace `grid grid-cols-1 md:grid-cols-2` with a vertical flex column (`flex flex-col`).
- All cards are full-width and stacked top-to-bottom.

### Card Order

1. **Current plan card** — same structure as today (plan name, pricing or "Free forever", renewal date, feature list, "Manage subscription" button for paid plans).
2. **All upgrade plan cards** — one card per plan with a tier higher than the current plan, sorted by tier ascending. Each card is self-contained with:
   - "Upgrade to" label and plan name.
   - Per-card monthly/annual billing toggle.
   - Price display that updates based on the toggle.
   - Feature list (including annual bonus features when annual is selected).
   - "Upgrade to {Plan Name}" button.
3. **Custom plan card** — shown only when the user is on the highest tier (no upgrade plans available). Same as today: "Need more?" heading, "Custom plan" title, contact message.

### Data Changes

#### `packages/auth/src/plans.ts`

Add a new helper function:

```ts
export function getUpgradePlans(currentPlan: Plan): Array<Plan> {
  return PLANS.filter((p) => p.tier > currentPlan.tier).sort(
    (a, b) => a.tier - b.tier
  );
}
```

The existing `getUpgradePlan()` remains unchanged (used elsewhere).

#### `apps/web/src/components/billing/billing-plan-cards.tsx`

**Interface change:**

- Replace `upgradePlan: Plan | null` with `upgradePlans: Array<Plan>`.
- The `isAnnual` / `onToggleInterval` props change from a single boolean to per-plan state. The parent component manages `Record<PlanId, boolean>` instead of a single `boolean`.

**Rendering:**

- Outer container changes from grid to `flex flex-col gap-4`.
- Current plan card: unchanged.
- Upgrade cards: `.map()` over `upgradePlans`, rendering one card per plan.
- Custom plan card: shown when `upgradePlans.length === 0`.

#### `apps/web/src/components/billing/billing-page.tsx`

- Import `getUpgradePlans` instead of (or in addition to) `getUpgradePlan`.
- Change `isAnnual` state from `boolean` to `Record<PlanId, boolean>` to track per-card toggle state.
- Pass `upgradePlans` array and per-plan toggle handlers to `BillingPlanCards`.

### Edge Cases

- **User on Free plan:** Shows current plan card, then Starter card, then Pro card.
- **User on Starter plan:** Shows current plan card (with manage button), then Pro card.
- **User on Pro plan:** Shows current plan card (with manage button), then "Custom plan" card.
- **Single plan defined:** If only the free plan exists, shows current plan card and "Custom plan" card.

### Responsive Behavior

- The layout is single-column at all breakpoints (no change from mobile to desktop column count).
- The page already has `max-w-2xl` constraint, so full-width cards are appropriately sized.

## Files to Modify

| File                                                     | Change                                                 |
| -------------------------------------------------------- | ------------------------------------------------------ |
| `packages/auth/src/plans.ts`                             | Add `getUpgradePlans()` helper                         |
| `apps/web/src/components/billing/billing-plan-cards.tsx` | New interface, vertical layout, map over upgrade plans |
| `apps/web/src/components/billing/billing-page.tsx`       | Per-plan annual state, pass `upgradePlans` array       |

## Out of Scope

- No changes to plan definitions, pricing, or features.
- No changes to the Stripe checkout/portal flow.
- No changes to the invoice table or downgrade banner.
- No visual redesign of individual card internals (just layout and multiplicity).
