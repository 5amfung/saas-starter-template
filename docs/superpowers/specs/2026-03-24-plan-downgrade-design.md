# Plan Downgrade Feature

## Problem

The workspace billing page supports upgrades but has no way for users to downgrade. Users must navigate to the Stripe Customer Portal to cancel or change plans. This is poor UX and makes downgrade paths invisible.

## Solution

Add a "Manage plan" modal accessible from the current plan card. The modal shows all plans side-by-side. Users can upgrade, downgrade, or cancel from a single interface. The existing upgrade cards on the billing page remain as prominent "ads" for higher-tier plans.

## Design Decisions

- **All downgrades take effect at period end.** The user keeps their current plan until the billing cycle ends, then transitions to the lower plan. This applies to both paid-to-paid (Pro → Starter via Stripe Subscription Schedule) and paid-to-free (cancellation at period end).
- **Confirmation dialog required for all downgrades.** Shows what the user will lose (feature diff, limit changes) and when the change takes effect.
- **Existing upgrade cards remain on the billing page.** They serve as marketing real estate and give users immediate visibility into upgrade options. The modal is an additional path, not a replacement.
- **Plan-agnostic logic.** All action resolution uses `plan.tier` comparisons. Adding a new plan requires zero UI code changes.
- **Interval-only changes are out of scope.** The monthly/annual toggle in the modal only affects pricing display for other plans. Switching from Pro Annual to Pro Monthly (same tier, different interval) is not supported in this feature. `getPlanAction` returns `'current'` for same-tier plans regardless of interval.

## Plan Action Resolution

A single pure function determines the action for any current/target plan pair:

```typescript
type PlanAction = 'current' | 'upgrade' | 'downgrade' | 'cancel';

function getPlanAction(currentPlan: Plan, targetPlan: Plan): PlanAction {
  if (targetPlan.tier === currentPlan.tier) return 'current';
  if (targetPlan.tier > currentPlan.tier)   return 'upgrade';
  if (targetPlan.pricing === null)          return 'cancel';
  return 'downgrade';
}
```

UI config is a static lookup from this action type:

```typescript
const PLAN_ACTION_CONFIG: Record<PlanAction, { label: string; variant: ButtonVariant }> = {
  current:   { label: 'Current plan', variant: 'ghost'   },
  upgrade:   { label: 'Upgrade',      variant: 'default' },
  downgrade: { label: 'Downgrade',    variant: 'outline' },
  cancel:    { label: 'Downgrade',    variant: 'outline' },
};
```

Cancel and downgrade are visually identical to the user — both say "Downgrade." The backend distinction is handled by the parent component choosing the correct mutation.

## Page Layout

The billing page layout stays the same. "Manage subscription" becomes "Manage plan":

```
┌─────────────────────────────────────────────┐
│  Current plan                               │
│  Pro            $49/mo                      │
│  Renews on April 15, 2026                   │
│  ✓ Up to 25 members   ✓ Email support       │
│  [ Manage plan ]                            │
└─────────────────────────────────────────────┘

┌─────────────────────────────────────────────┐
│  Upgrade cards (as today, or "Custom plan") │
└─────────────────────────────────────────────┘

┌─────────────────────────────────────────────┐
│  Invoices                                   │
└─────────────────────────────────────────────┘
```

## Manage Plan Modal

Shows all plans side-by-side with a single monthly/annual toggle. Current plan is marked and disabled. Higher plans show "Upgrade" (primary), lower plans show "Downgrade" (outline/muted).

```
┌───────────────────────────────────────────────────────────────┐
│                                                        [ × ] │
│                     Manage your plan                         │
│                   Current plan: Pro                          │
│                                                              │
│            [ Monthly | Annual ]  Save 17% annually           │
│                                                              │
│  ┌───────────────┐ ┌───────────────┐ ┌───────────────┐      │
│  │ Free           │ │ Starter        │ │ Pro  Current  │      │
│  │ Free forever   │ │ $5/mo          │ │ $49/mo        │      │
│  │ ✓ 1 member     │ │ ✓ Up to 5      │ │ ✓ Up to 25    │      │
│  │                │ │   members      │ │   members     │      │
│  │                │ │                │ │ ✓ Email       │      │
│  │                │ │                │ │   support     │      │
│  │ [Downgrade]    │ │ [Downgrade]    │ │ [Current plan]│      │
│  │  (outline)     │ │  (outline)     │ │  (disabled)   │      │
│  └───────────────┘ └───────────────┘ └───────────────┘      │
│                                                              │
└───────────────────────────────────────────────────────────────┘
```

Responsive: on mobile, plan cards stack vertically and the modal is scrollable.

## Downgrade Confirmation Dialog

Shown when the user clicks any "Downgrade" button in the modal:

```
┌─────────────────────────────────────────────┐
│  Downgrade to Starter?                      │
│                                             │
│  Your Pro plan will remain active until     │
│  April 15, 2026. After that:               │
│                                             │
│  • Member limit drops from 25 → 5           │
│  • Email support no longer available         │
│                                             │
│  ⚠ You currently have 12 members. The       │
│    Starter plan allows up to 5. You'll need │
│    to remove members before the change      │
│    takes effect.                            │
│                                             │
│         [ Cancel ]   [ Confirm downgrade ]  │
└─────────────────────────────────────────────┘
```

The feature diff and limit warning are computed dynamically from `currentPlan` and `targetPlan` — no hardcoded plan knowledge.

## Downgrade Banner Enhancement

The existing `BillingDowngradeBanner` currently hardcodes the target as "Free." It needs to show the actual target plan:

- **Cancel (paid → Free)**: "Your plan will downgrade to Free on {date}."
- **Scheduled downgrade (Pro → Starter)**: "Your plan will change to Starter on {date}."

The target plan name comes from the Stripe subscription schedule or cancellation state returned by `getWorkspaceBillingData`.

## Component Changes

### New components

| File                                   | Purpose                                                          |
| -------------------------------------- | ---------------------------------------------------------------- |
| `billing-manage-plan-dialog.tsx`       | Modal with all plan cards, monthly/annual toggle, action buttons |
| `billing-downgrade-confirm-dialog.tsx` | Confirmation dialog with feature diff and limit warnings         |

### Modified components

| File                           | Change                                                                                        |
| ------------------------------ | --------------------------------------------------------------------------------------------- |
| `billing-plan-cards.tsx`       | Rename `onManage` → `onManagePlan`, button text "Manage subscription" → "Manage plan"         |
| `billing-page.tsx`             | Wire up modal state, add downgrade/cancel mutations, pass member count to confirmation dialog |
| `billing-downgrade-banner.tsx` | Accept dynamic target plan name instead of hardcoding "Free"                                  |

### Modified utilities

| File                         | Change                                                                                  |
| ---------------------------- | --------------------------------------------------------------------------------------- |
| `packages/auth/src/plans.ts` | Add `getDowngradePlans()`, `getPlanAction()`, `PLAN_ACTION_CONFIG`, `computePlanDiff()` |

## Server-Side Changes

### New server functions (`billing.functions.ts` + `billing.server.ts`)

**`downgradeWorkspaceSubscription`** — For paid → lower paid:

- Input: `{ workspaceId, planId, annual, subscriptionId }`
- Calls `auth.api.upgradeSubscription()` with `scheduleAtPeriodEnd: true`
- Validates `targetPlan.tier < currentPlan.tier` and `targetPlan.pricing !== null`
- Returns `{ success: true }`

**`cancelWorkspaceSubscription`** — For paid → Free:

- Input: `{ workspaceId }`
- Calls Stripe SDK directly: `stripeClient.subscriptions.update(subscriptionId, { cancel_at_period_end: true })`
- Better Auth does not provide a server-side cancel API — `authClient.subscription.cancel` redirects to the Stripe Billing Portal. We bypass this and call Stripe directly.
- The Better Auth subscription record will be updated when the Stripe `customer.subscription.updated` webhook fires (existing webhook handler already handles `cancel_at_period_end` changes).
- Validates user owns workspace and subscription is active
- Returns `{ success: true }`

### Modified server functions

**`getWorkspaceBillingData`** — Extend return type to include:

- `scheduledTargetPlan`: The plan the subscription is scheduled to change to (if a Stripe Subscription Schedule exists). Determined by calling `stripeClient.subscriptionSchedules.retrieve(scheduleId)`, reading the next phase's price ID, and reverse-mapping it to a `PlanId` via the price-to-plan mapping defined in the Stripe plugin config.
- This allows the downgrade banner to show "will change to Starter" vs. "will downgrade to Free."

### Validation (tier-based)

- Both functions verify `targetPlan.tier < currentPlan.tier` using the `PLANS` array.
- Ownership enforced via Better Auth's `authorizeReference`.
- Reject if subscription already has a pending cancellation or schedule.

### Reactivation paths

Two distinct reactivation flows depending on the pending change type:

- **Pending cancellation** (paid → Free): `auth.api.restoreSubscription()` — removes `cancel_at_period_end` flag. This is the existing flow.
- **Scheduled downgrade** (Pro → Starter): `stripeClient.subscriptionSchedules.release(scheduleId)` — releases the schedule, keeping the current subscription as-is. The existing `reactivateWorkspaceSubscription` function needs to detect which case applies and call the appropriate API.

## Stripe Portal Access

The "Manage subscription" button currently opens Stripe Portal. Since it becomes "Manage plan," we need an alternative path to the portal for payment method management, address changes, etc.

Options: a "Billing portal" text link in the current plan card footer, or a link inside the manage plan modal footer. Either works — keep it accessible but secondary.

## `computePlanDiff()` Specification

```typescript
interface LimitChange {
  label: string;       // e.g., "Member limit"
  from: number | string; // e.g., 25 or "Unlimited"
  to: number | string;   // e.g., 5
}

interface PlanDiff {
  lostFeatures: string[];   // Features in current plan but not in target (string comparison of features arrays).
  limitChanges: LimitChange[]; // Limits that decrease. Compares each field in PlanLimits.
}

function computePlanDiff(currentPlan: Plan, targetPlan: Plan): PlanDiff;
```

Example: Pro → Starter returns `{ lostFeatures: ['Email customer support'], limitChanges: [{ label: 'Member limit', from: 25, to: 5 }] }`.

## Error Handling

- **Stripe API errors** — Both downgrade and cancel mutations show a toast error (consistent with existing upgrade flow). The modal/confirmation dialog remains open so the user can retry.
- **Network timeout** — Same toast pattern. No auto-retry.
- **Webhook delay** — After a successful downgrade/cancel call, the UI optimistically shows the downgrade banner. If the webhook hasn't updated the database yet, a page refresh may briefly show stale state. This is acceptable — the banner will appear after the next data fetch.

## Member Limit Enforcement at Period End

When a downgrade takes effect and the workspace has more members than the new plan allows:

- Existing members **retain access** — no one is removed automatically.
- The workspace **cannot add new members** until the count is at or below the limit.
- This matches the existing `checkWorkspacePlanLimit` enforcement which blocks the `addMember` action, not existing membership.

## Verified Assumptions

1. **`upgradeSubscription` accepts lower-tier plans.** Confirmed by reading the Better Auth Stripe plugin source (`index.mjs`, lines 500-1011). The function only rejects if the target plan is the exact same plan + price + seats. There is no tier comparison logic. It is a generic plan-switch operation.

2. **`scheduleAtPeriodEnd: true` creates a Stripe Subscription Schedule.** Confirmed at line 759 of the plugin source. It calls `stripeClient.subscriptionSchedules.create()` with the new plan's price in a future phase.

3. **Direct Stripe SDK calls are safe alongside Better Auth.** The project already initializes a `stripeClient` instance in `packages/auth/src/auth.server.ts`. Better Auth's webhook handlers process `customer.subscription.updated` and `customer.subscription.deleted` events, which will fire when we modify subscriptions directly. The database stays in sync via webhooks.

## Edge Cases

1. **Pending cancellation exists** — Modal shows notice, disables downgrade buttons. User must reactivate first via existing banner.
2. **Member count exceeds target limit** — Confirmation dialog shows warning (not a blocker). User needs to remove members before period end.
3. **Annual → Monthly switch on downgrade** — Handled by `scheduleAtPeriodEnd`. Stripe schedules both plan and interval change at period end.
4. **Free user opens modal** — No "Manage plan" button shown (same as today — button only appears for paid plans). Free users reach the modal only if we add an entry point, which is out of scope.
5. **Reactivation after scheduled downgrade** — "Keep subscription" on the banner releases the Stripe Subscription Schedule (via `subscriptionSchedules.release()`), keeping the current plan. This is distinct from cancellation reactivation which uses `auth.api.restoreSubscription()`.
6. **Free user with deep link to modal** — If a free user somehow reaches the modal (e.g., direct URL with query param), all plans above Free show "Upgrade" and Free shows "Current plan." No downgrade buttons appear. The modal is functional but redundant — same as the upgrade cards on the page.

## Testing Strategy

### Unit tests

- `getPlanAction()` — Correct action for all plan pairs
- `getDowngradePlans()` — Correct lower-tier plans for each plan
- `computePlanDiff()` — Correct feature and limit diff between plan pairs
- `billing-manage-plan-dialog.tsx` — Correct button labels, styles, and disabled state per plan
- `billing-downgrade-confirm-dialog.tsx` — Shows target plan, period end, feature loss, member limit warning

### Integration tests

- Full downgrade flow: "Manage plan" → select lower plan → confirmation → confirm → mutation called → dialog closes → banner appears
- Cancel flow: same but for paid → Free
- Pending cancellation state: modal shows notice, buttons disabled
- Reactivation clears scheduled downgrade

### E2E tests

- Full downgrade flow against Stripe test mode (stretch goal).
