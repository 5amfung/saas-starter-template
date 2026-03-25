# Plan Downgrade Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow users to downgrade their workspace plan (Pro → Starter, any paid → Free) via a "Manage plan" modal on the billing page.

**Architecture:** Add plan-agnostic utility functions (`getPlanAction`, `getDowngradePlans`, `computePlanDiff`) to `packages/auth/src/plans.ts`. Add two new server functions for downgrade and cancel. Build a "Manage plan" modal and a downgrade confirmation dialog. Wire them into the existing billing page. All action resolution uses `plan.tier` comparisons — no hardcoded plan IDs.

**Tech Stack:** React 19, TanStack Start (server functions), Better Auth Stripe plugin, Stripe SDK, shadcn/ui (Dialog), Vitest + Testing Library.

**Spec:** `docs/superpowers/specs/2026-03-24-plan-downgrade-design.md`

---

## File Structure

### New files

| File                                                                   | Responsibility                                                                                                          |
| ---------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `packages/auth/src/plan-actions.ts`                                    | `PlanAction` type, `getPlanAction()`, `PLAN_ACTION_CONFIG`, `getDowngradePlans()`, `computePlanDiff()` — pure functions |
| `packages/auth/test/unit/plan-actions.test.ts`                         | Unit tests for all plan action utilities                                                                                |
| `apps/web/src/components/billing/billing-manage-plan-dialog.tsx`       | Modal showing all plans with upgrade/downgrade/current buttons                                                          |
| `apps/web/src/components/billing/billing-downgrade-confirm-dialog.tsx` | Confirmation dialog with feature diff and limit warnings                                                                |
| `apps/web/test/unit/billing/billing-manage-plan-dialog.test.tsx`       | Unit tests for the manage plan modal                                                                                    |
| `apps/web/test/unit/billing/billing-downgrade-confirm-dialog.test.tsx` | Unit tests for the confirmation dialog                                                                                  |

### Modified files

| File                                                           | Change                                                                                                                                                                                                                                                        |
| -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/auth/src/plans.ts`                                   | Re-export from `plan-actions.ts` for clean public API                                                                                                                                                                                                         |
| `packages/auth/src/billing.server.ts`                          | Add `stripeScheduleId` to `resolveSubscriptionDetails`, add `cancelSubscriptionAtPeriodEnd`, `getSubscriptionSchedule`, `releaseSubscriptionSchedule`, `getPlanIdByPriceId` to `createBillingHelpers` return object                                           |
| `apps/web/src/billing/billing.server.ts`                       | Add `downgradeWorkspaceSubscription()`, `cancelWorkspaceSubscription()`, extend `getWorkspaceBillingData` to return `scheduledTargetPlanId` and `memberCount`, update `reactivateWorkspaceSubscription` to handle both cancellations and scheduled downgrades |
| `apps/web/src/billing/billing.functions.ts`                    | Add `downgradeWorkspaceSubscription` and `cancelWorkspaceSubscription` server function wrappers                                                                                                                                                               |
| `apps/web/src/components/billing/billing-plan-cards.tsx`       | Rename `onManage` → `onManagePlan`, button text → "Manage plan", add "Billing portal" text link for Stripe Portal access                                                                                                                                      |
| `apps/web/src/components/billing/billing-downgrade-banner.tsx` | No changes needed — already accepts `targetPlanName` as prop                                                                                                                                                                                                  |
| `apps/web/src/components/billing/billing-page.tsx`             | Wire up modal state, downgrade/cancel mutations, pass `scheduledTargetPlanId` to banner                                                                                                                                                                       |

---

## Task 1: Plan Action Utilities

**Files:**

- Create: `packages/auth/src/plan-actions.ts`
- Create: `packages/auth/test/unit/plan-actions.test.ts`
- Modify: `packages/auth/src/plans.ts` (add re-export)

- [ ] **Step 1: Write failing tests for `getPlanAction()`**

Create `packages/auth/test/unit/plan-actions.test.ts`:

```typescript
import { describe, expect, it } from 'vitest';
import { getPlanById } from '../../src/plans';
import { getPlanAction } from '../../src/plan-actions';

describe('getPlanAction', () => {
  const free = getPlanById('free')!;
  const starter = getPlanById('starter')!;
  const pro = getPlanById('pro')!;

  it('returns "current" for same plan', () => {
    expect(getPlanAction(pro, pro)).toBe('current');
  });

  it('returns "upgrade" when target tier is higher', () => {
    expect(getPlanAction(free, starter)).toBe('upgrade');
    expect(getPlanAction(free, pro)).toBe('upgrade');
    expect(getPlanAction(starter, pro)).toBe('upgrade');
  });

  it('returns "cancel" when target is free (no pricing)', () => {
    expect(getPlanAction(pro, free)).toBe('cancel');
    expect(getPlanAction(starter, free)).toBe('cancel');
  });

  it('returns "downgrade" when target is lower tier with pricing', () => {
    expect(getPlanAction(pro, starter)).toBe('downgrade');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @workspace/auth test test/unit/plan-actions.test.ts`
Expected: FAIL — module `plan-actions` not found.

- [ ] **Step 3: Implement `getPlanAction()` and `PLAN_ACTION_CONFIG`**

Create `packages/auth/src/plan-actions.ts`:

```typescript
import type { Plan } from './plans';

export type PlanAction = 'current' | 'upgrade' | 'downgrade' | 'cancel';

/**
 * Determines the action type for switching from one plan to another.
 * Uses tier comparison — adding new plans requires no changes here.
 */
export function getPlanAction(currentPlan: Plan, targetPlan: Plan): PlanAction {
  if (targetPlan.tier === currentPlan.tier) return 'current';
  if (targetPlan.tier > currentPlan.tier) return 'upgrade';
  if (targetPlan.pricing === null) return 'cancel';
  return 'downgrade';
}

type ButtonVariant = 'default' | 'outline' | 'ghost';

export const PLAN_ACTION_CONFIG: Record<
  PlanAction,
  { label: string; variant: ButtonVariant }
> = {
  current: { label: 'Current plan', variant: 'ghost' },
  upgrade: { label: 'Upgrade', variant: 'default' },
  downgrade: { label: 'Downgrade', variant: 'outline' },
  cancel: { label: 'Downgrade', variant: 'outline' },
};
```

- [ ] **Step 4: Run tests to verify `getPlanAction` passes**

Run: `pnpm --filter @workspace/auth test test/unit/plan-actions.test.ts`
Expected: All `getPlanAction` tests PASS.

- [ ] **Step 5: Write failing tests for `getDowngradePlans()`**

Append to `packages/auth/test/unit/plan-actions.test.ts`:

```typescript
import { getDowngradePlans } from '../../src/plan-actions';

describe('getDowngradePlans', () => {
  const free = getPlanById('free')!;
  const starter = getPlanById('starter')!;
  const pro = getPlanById('pro')!;

  it('returns empty array for free plan', () => {
    expect(getDowngradePlans(free)).toHaveLength(0);
  });

  it('returns only free for starter', () => {
    const downgrades = getDowngradePlans(starter);
    expect(downgrades).toHaveLength(1);
    expect(downgrades[0].id).toBe('free');
  });

  it('returns starter and free for pro (descending tier)', () => {
    const downgrades = getDowngradePlans(pro);
    expect(downgrades).toHaveLength(2);
    expect(downgrades[0].id).toBe('starter');
    expect(downgrades[1].id).toBe('free');
  });
});
```

- [ ] **Step 6: Run tests to verify they fail**

Run: `pnpm --filter @workspace/auth test test/unit/plan-actions.test.ts`
Expected: FAIL — `getDowngradePlans` not exported.

- [ ] **Step 7: Implement `getDowngradePlans()`**

Add to `packages/auth/src/plan-actions.ts`:

```typescript
import { PLANS } from './plans';
import type { Plan } from './plans';

/**
 * Returns all plans below the current plan's tier, sorted by tier descending.
 * The highest available downgrade option comes first.
 */
export function getDowngradePlans(currentPlan: Plan): Array<Plan> {
  return PLANS.filter((p) => p.tier < currentPlan.tier).sort(
    (a, b) => b.tier - a.tier
  );
}
```

- [ ] **Step 8: Run tests to verify they pass**

Run: `pnpm --filter @workspace/auth test test/unit/plan-actions.test.ts`
Expected: All tests PASS.

- [ ] **Step 9: Write failing tests for `computePlanDiff()`**

Append to `packages/auth/test/unit/plan-actions.test.ts`:

```typescript
import { computePlanDiff } from '../../src/plan-actions';

describe('computePlanDiff', () => {
  const free = getPlanById('free')!;
  const starter = getPlanById('starter')!;
  const pro = getPlanById('pro')!;

  it('returns lost features and limit changes for pro → starter', () => {
    const diff = computePlanDiff(pro, starter);
    expect(diff.lostFeatures).toContain('Email customer support');
    expect(diff.limitChanges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: 'Member limit', from: 25, to: 5 }),
      ])
    );
  });

  it('returns lost features and limit changes for pro → free', () => {
    const diff = computePlanDiff(pro, free);
    expect(diff.lostFeatures).toContain('Email customer support');
    expect(diff.limitChanges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: 'Member limit', from: 25, to: 1 }),
      ])
    );
  });

  it('returns empty diff for same plan', () => {
    const diff = computePlanDiff(pro, pro);
    expect(diff.lostFeatures).toHaveLength(0);
    expect(diff.limitChanges).toHaveLength(0);
  });

  it('returns limit change for starter → free', () => {
    const diff = computePlanDiff(starter, free);
    expect(diff.limitChanges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: 'Member limit', from: 5, to: 1 }),
      ])
    );
  });
});
```

- [ ] **Step 10: Run tests to verify they fail**

Run: `pnpm --filter @workspace/auth test test/unit/plan-actions.test.ts`
Expected: FAIL — `computePlanDiff` not exported.

- [ ] **Step 11: Implement `computePlanDiff()`**

Add to `packages/auth/src/plan-actions.ts`:

```typescript
export interface LimitChange {
  label: string;
  from: number | string;
  to: number | string;
}

export interface PlanDiff {
  lostFeatures: string[];
  limitChanges: LimitChange[];
}

const LIMIT_LABELS: Record<keyof PlanLimits, string> = {
  maxMembers: 'Member limit',
};

/**
 * Computes the difference between two plans — features lost and limits reduced.
 * Used by the downgrade confirmation dialog.
 */
export function computePlanDiff(currentPlan: Plan, targetPlan: Plan): PlanDiff {
  const lostFeatures = currentPlan.features.filter(
    (f) => !targetPlan.features.includes(f)
  );

  const limitChanges: LimitChange[] = [];
  for (const key of Object.keys(currentPlan.limits) as Array<keyof PlanLimits>) {
    const from = currentPlan.limits[key];
    const to = targetPlan.limits[key];
    if (from !== to && (from === -1 || to === -1 || to < from)) {
      limitChanges.push({
        label: LIMIT_LABELS[key] ?? key,
        from: from === -1 ? 'Unlimited' : from,
        to: to === -1 ? 'Unlimited' : to,
      });
    }
  }

  return { lostFeatures, limitChanges };
}
```

Note: Import `PlanLimits` from `./plans` alongside the existing `Plan` import.

- [ ] **Step 12: Run all tests to verify they pass**

Run: `pnpm --filter @workspace/auth test test/unit/plan-actions.test.ts`
Expected: All tests PASS.

- [ ] **Step 13: Add re-export to `plans.ts`**

Add to the bottom of `packages/auth/src/plans.ts`:

```typescript
// ── Plan action utilities ────────────────────────────────────────────
export {
  getPlanAction,
  getDowngradePlans,
  computePlanDiff,
  PLAN_ACTION_CONFIG,
} from './plan-actions';
export type { PlanAction, PlanDiff, LimitChange } from './plan-actions';
```

- [ ] **Step 14: Run existing plans tests to verify no regressions**

Run: `pnpm --filter @workspace/auth test test/unit/plans.test.ts`
Expected: All existing tests PASS.

- [ ] **Step 15: Commit**

```bash
git add packages/auth/src/plan-actions.ts packages/auth/test/unit/plan-actions.test.ts packages/auth/src/plans.ts
git commit -m "feat(auth): add plan action utilities for downgrade support

Add getPlanAction(), getDowngradePlans(), computePlanDiff(), and
PLAN_ACTION_CONFIG. All functions are tier-based and plan-agnostic."
```

---

## Task 2: Extend Subscription Details with Schedule ID

**Files:**

- Modify: `packages/auth/src/billing.server.ts:119-149`
- Modify: `packages/auth/test/unit/billing.server.test.ts`

- [ ] **Step 1: Write failing test for `stripeScheduleId` in `resolveSubscriptionDetails`**

Add a test to `packages/auth/test/unit/billing.server.test.ts` (in the `resolveSubscriptionDetails` describe block):

```typescript
it('returns stripeScheduleId when present', () => {
  const result = resolveSubscriptionDetails(
    [
      {
        plan: 'pro',
        status: 'active',
        stripeSubscriptionId: 'sub_123',
        stripeScheduleId: 'sub_sched_123',
      },
    ],
    'pro'
  );
  expect(result?.stripeScheduleId).toBe('sub_sched_123');
});

it('returns null stripeScheduleId when absent', () => {
  const result = resolveSubscriptionDetails(
    [{ plan: 'pro', status: 'active', stripeSubscriptionId: 'sub_123' }],
    'pro'
  );
  expect(result?.stripeScheduleId).toBeNull();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @workspace/auth test test/unit/billing.server.test.ts`
Expected: FAIL — `stripeScheduleId` not in return type.

- [ ] **Step 3: Add `stripeScheduleId` to `resolveSubscriptionDetails`**

In `packages/auth/src/billing.server.ts`, update `resolveSubscriptionDetails`:

1. Add `stripeScheduleId?: string | null;` to the input type's readonly array item.
2. Add `stripeScheduleId: string | null;` to the return type.
3. Add `stripeScheduleId: active.stripeScheduleId ?? null,` to the return object.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @workspace/auth test test/unit/billing.server.test.ts`
Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/auth/src/billing.server.ts packages/auth/test/unit/billing.server.test.ts
git commit -m "feat(auth): expose stripeScheduleId in resolveSubscriptionDetails

Needed by the billing page to detect scheduled downgrades and show
the correct target plan in the downgrade banner."
```

---

## Task 3: Server-Side Downgrade and Cancel Functions

**Files:**

- Modify: `packages/auth/src/billing.server.ts` (add new helpers to `createBillingHelpers`)
- Modify: `packages/auth/src/auth.server.ts` (build `priceToPlanMap`, pass to `createBillingHelpers`)
- Modify: `apps/web/src/billing/billing.server.ts`
- Modify: `apps/web/src/billing/billing.functions.ts`
- Modify: `apps/web/test/unit/billing/billing.server.test.ts`

**Prereqs:** Task 2 (`stripeScheduleId` in `resolveSubscriptionDetails`).

- [ ] **Step 1: Write failing tests for `downgradeWorkspaceSubscription`**

Add tests to `apps/web/test/unit/billing/billing.server.test.ts`. The test should mock `auth.api.upgradeSubscription` and verify it's called with `scheduleAtPeriodEnd: true` and the correct plan. Read the existing test file first to match the mocking patterns used.

```typescript
describe('downgradeWorkspaceSubscription', () => {
  it('calls upgradeSubscription with scheduleAtPeriodEnd: true', async () => {
    // Mock auth.api.upgradeSubscription
    // Call downgradeWorkspaceSubscription with Pro → Starter args
    // Assert upgradeSubscription was called with:
    //   plan: 'starter', scheduleAtPeriodEnd: true, subscriptionId: 'sub_123'
  });

  it('throws if target plan tier is not lower than current', async () => {
    // Mock getWorkspaceActivePlanId to return 'starter'
    // Call with planId: 'pro' (upgrade, not downgrade)
    // Expect error
  });

  it('throws if target plan has no pricing (use cancelWorkspaceSubscription instead)', async () => {
    // Mock getWorkspaceActivePlanId to return 'pro'
    // Call with planId: 'free'
    // Expect error
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @workspace/web test test/unit/billing/billing.server.test.ts`
Expected: FAIL — function not found.

- [ ] **Step 3: Implement `downgradeWorkspaceSubscription` in `billing.server.ts`**

Add to `apps/web/src/billing/billing.server.ts`:

```typescript
/**
 * Schedules a downgrade to a lower paid plan at the end of the current billing period.
 * Uses Better Auth's upgradeSubscription with scheduleAtPeriodEnd: true.
 */
export async function downgradeWorkspaceSubscription(
  headers: Headers,
  workspaceId: string,
  planId: PlanId,
  annual: boolean,
  subscriptionId: string
) {
  const currentPlanId = await getWorkspaceActivePlanId(headers, workspaceId);
  const currentPlan = getPlanById(currentPlanId) ?? getFreePlan();
  const targetPlan = getPlanById(planId);

  if (!targetPlan) throw new Error('Unknown plan.');
  if (targetPlan.tier >= currentPlan.tier) throw new Error('Target plan must be a lower tier.');
  if (!targetPlan.pricing) throw new Error('Cannot downgrade to free plan. Use cancel instead.');

  await auth.api.upgradeSubscription({
    headers,
    body: {
      plan: planId,
      annual,
      referenceId: workspaceId,
      customerType: 'organization',
      subscriptionId,
      scheduleAtPeriodEnd: true,
      successUrl: `${process.env.BETTER_AUTH_URL}/ws/${workspaceId}/billing?downgrade=scheduled`,
      cancelUrl: `${process.env.BETTER_AUTH_URL}/ws/${workspaceId}/billing`,
    },
  });

  return { success: true };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @workspace/web test test/unit/billing/billing.server.test.ts`
Expected: `downgradeWorkspaceSubscription` tests PASS.

- [ ] **Step 5: Write failing tests for `cancelWorkspaceSubscription`**

Add tests to `apps/web/test/unit/billing/billing.server.test.ts`:

```typescript
describe('cancelWorkspaceSubscription', () => {
  it('calls stripeClient.subscriptions.update with cancel_at_period_end', async () => {
    // Mock auth.api.listActiveSubscriptions to return active pro subscription
    // Mock stripeClient.subscriptions.update
    // Call cancelWorkspaceSubscription
    // Assert stripe called with { cancel_at_period_end: true }
  });

  it('throws if no active subscription found', async () => {
    // Mock listActiveSubscriptions to return empty
    // Expect error
  });
});
```

- [ ] **Step 6: Run tests to verify they fail**

Run: `pnpm --filter @workspace/web test test/unit/billing/billing.server.test.ts`
Expected: FAIL — function not found.

- [ ] **Step 7: Implement `cancelWorkspaceSubscription` in `billing.server.ts`**

This function needs access to the Stripe client. The `createBillingHelpers` in `packages/auth/src/billing.server.ts` already creates a `stripeClient` but doesn't expose it. Two options:

Option A: Add a `cancelSubscriptionAtPeriodEnd` helper to `createBillingHelpers` and expose it via `auth.billing`.
Option B: Create a separate Stripe client instance in `apps/web/src/billing/billing.server.ts`.

**Prefer Option A** — keeps Stripe access centralized:

1. In `packages/auth/src/billing.server.ts`, add to `createBillingHelpers`:

```typescript
/** Cancels a Stripe subscription at period end. */
async function cancelSubscriptionAtPeriodEnd(stripeSubscriptionId: string) {
  await stripeClient.subscriptions.update(stripeSubscriptionId, {
    cancel_at_period_end: true,
  });
}
```

2. Export it from the return object.

3. In `apps/web/src/billing/billing.server.ts`, add:

```typescript
/**
 * Cancels a workspace subscription at period end (paid → Free).
 * Calls Stripe directly since Better Auth's cancel redirects to the portal.
 */
export async function cancelWorkspaceSubscription(
  headers: Headers,
  workspaceId: string
) {
  const subscriptions = await auth.api.listActiveSubscriptions({
    headers,
    query: { referenceId: workspaceId, customerType: 'organization' },
  });

  const active = Array.from(subscriptions).filter(
    (s) => s.status === 'active' || s.status === 'trialing'
  );

  if (active.length === 0) {
    throw new Error('No active subscription found.');
  }

  const bestPlanId = resolveWorkspacePlanId(active);
  const target = active.find((s) => s.plan === bestPlanId);
  if (!target?.stripeSubscriptionId) {
    throw new Error('Could not find subscription to cancel.');
  }

  await auth.billing.cancelSubscriptionAtPeriodEnd(target.stripeSubscriptionId);
  return { success: true };
}
```

- [ ] **Step 8: Run tests to verify they pass**

Run: `pnpm --filter @workspace/web test test/unit/billing/billing.server.test.ts`
Expected: All tests PASS.

- [ ] **Step 9: Add server function wrappers in `billing.functions.ts`**

Add to `apps/web/src/billing/billing.functions.ts`:

```typescript
const downgradeInput = z.object({
  workspaceId: z.string(),
  planId: z.enum(VALID_PLAN_IDS),
  annual: z.boolean(),
  subscriptionId: z.string(),
});

/**
 * Schedules a downgrade to a lower paid plan at period end.
 */
export const downgradeWorkspaceSubscription = createServerFn()
  .inputValidator(downgradeInput)
  .handler(async ({ data }) => {
    const session = await requireVerifiedSession();
    await requireWorkspaceOwner(session, data.workspaceId);
    const headers = getRequestHeaders();
    return downgradeWorkspaceSubscriptionServer(
      headers,
      data.workspaceId,
      data.planId,
      data.annual,
      data.subscriptionId
    );
  });

/**
 * Cancels a workspace subscription at period end (downgrades to Free).
 */
export const cancelWorkspaceSubscription = createServerFn()
  .inputValidator(z.object({ workspaceId: z.string() }))
  .handler(async ({ data }) => {
    const session = await requireVerifiedSession();
    await requireWorkspaceOwner(session, data.workspaceId);
    const headers = getRequestHeaders();
    return cancelWorkspaceSubscriptionServer(headers, data.workspaceId);
  });
```

Add the corresponding imports at the top:

```typescript
import {
  // ...existing imports...
  cancelWorkspaceSubscription as cancelWorkspaceSubscriptionServer,
  downgradeWorkspaceSubscription as downgradeWorkspaceSubscriptionServer,
} from '@/billing/billing.server';
```

- [ ] **Step 10: Extend `getWorkspaceBillingData` to return `scheduledTargetPlanId` and `memberCount`**

In `apps/web/src/billing/billing.server.ts`, update `getWorkspaceBillingData`:

```typescript
export async function getWorkspaceBillingData(
  headers: Headers,
  workspaceId: string
) {
  const subscriptions = await auth.api.listActiveSubscriptions({
    headers,
    query: { referenceId: workspaceId, customerType: 'organization' },
  });
  const subArray = Array.from(subscriptions);

  const planId = resolveWorkspacePlanId(subArray);
  const plan = getPlanById(planId) ?? getFreePlan();
  const subscription = resolveSubscriptionDetails(subArray, planId);

  // Resolve scheduled target plan from Stripe Subscription Schedule.
  let scheduledTargetPlanId: PlanId | null = null;
  if (subscription?.stripeScheduleId) {
    scheduledTargetPlanId = await resolveScheduledTargetPlanId(
      subscription.stripeScheduleId
    );
  }

  // Get current member count for limit warnings in the downgrade dialog.
  const memberCount = await auth.billing.countWorkspaceMembers(workspaceId);

  return { planId, plan, subscription, scheduledTargetPlanId, memberCount };
}
```

Add the helper function `resolveScheduledTargetPlanId` — this calls Stripe to look up the schedule's next phase and reverse-maps the price ID to a plan. The price-to-plan mapping needs to be built from the Stripe plugin config.

```typescript
/**
 * Retrieves the target plan from a Stripe Subscription Schedule.
 * Reads the next phase's price ID and maps it back to a PlanId.
 */
async function resolveScheduledTargetPlanId(
  scheduleId: string
): Promise<PlanId | null> {
  try {
    const schedule =
      await auth.billing.getSubscriptionSchedule(scheduleId);
    if (!schedule || schedule.phases.length < 2) return null;

    // The second phase is the scheduled change.
    const nextPhase = schedule.phases[1];
    const priceId = nextPhase?.items?.[0]?.price;
    if (!priceId || typeof priceId !== 'string') return null;

    return auth.billing.getPlanIdByPriceId(priceId) ?? null;
  } catch {
    return null;
  }
}
```

This requires new helpers in `packages/auth/src/billing.server.ts`'s `createBillingHelpers`. Update the function signature to accept a price-to-plan map, and add these to the return object:

```typescript
// Update createBillingHelpers signature:
export function createBillingHelpers(
  db: Database,
  stripeSecretKey: string,
  priceToPlanMap: Record<string, PlanId>  // NEW param
) {
  // ...existing code...

  /** Cancels a Stripe subscription at period end. */
  async function cancelSubscriptionAtPeriodEnd(stripeSubscriptionId: string) {
    await stripeClient.subscriptions.update(stripeSubscriptionId, {
      cancel_at_period_end: true,
    });
  }

  /** Retrieves a Stripe Subscription Schedule. */
  async function getSubscriptionSchedule(scheduleId: string) {
    return stripeClient.subscriptionSchedules.retrieve(scheduleId);
  }

  /** Releases a Stripe Subscription Schedule. */
  async function releaseSubscriptionSchedule(scheduleId: string) {
    await stripeClient.subscriptionSchedules.release(scheduleId);
  }

  /** Reverse-maps a Stripe price ID to a PlanId. */
  function getPlanIdByPriceId(priceId: string): PlanId | null {
    return priceToPlanMap[priceId] ?? null;
  }

  return {
    // ...existing...
    cancelSubscriptionAtPeriodEnd,
    getSubscriptionSchedule,
    releaseSubscriptionSchedule,
    getPlanIdByPriceId,
  };
}
```

The `priceToPlanMap` is built at startup in `packages/auth/src/auth.server.ts` from the `stripePlans` config. Read that file during implementation to find the exact structure. Build the reverse map:

```typescript
// In auth.server.ts where createBillingHelpers is called:
const priceToPlanMap: Record<string, PlanId> = {};
for (const sp of stripePlans) {
  if (sp.priceId) priceToPlanMap[sp.priceId] = sp.name as PlanId;
  if (sp.annualPriceId) priceToPlanMap[sp.annualPriceId] = sp.name as PlanId;
}
const billing = createBillingHelpers(db, config.stripe.secretKey, priceToPlanMap);
```

- [ ] **Step 11: Run all billing server tests**

Run: `pnpm --filter @workspace/web test test/unit/billing/billing.server.test.ts`
Expected: All tests PASS.

- [ ] **Step 12: Run typecheck**

Run: `pnpm run typecheck`
Expected: No type errors.

- [ ] **Step 13: Commit**

```bash
git add packages/auth/src/billing.server.ts apps/web/src/billing/billing.server.ts apps/web/src/billing/billing.functions.ts apps/web/test/unit/billing/billing.server.test.ts
git commit -m "feat(billing): add downgrade and cancel server functions

- downgradeWorkspaceSubscription: schedules plan switch at period end
- cancelWorkspaceSubscription: cancels subscription at period end
- Extend getWorkspaceBillingData with scheduledTargetPlanId and memberCount
- Add cancelSubscriptionAtPeriodEnd, getSubscriptionSchedule,
  getPlanIdByPriceId helpers to auth billing"
```

---

## Task 4: Update Reactivation to Handle Scheduled Downgrades

**Files:**

- Modify: `apps/web/src/billing/billing.server.ts` (`reactivateWorkspaceSubscription`)
- Modify: `apps/web/test/unit/billing/billing.server.test.ts`

**Prereqs:** Task 2 (`stripeScheduleId` in subscription details), Task 3 (`releaseSubscriptionSchedule` helper).

The existing `reactivateWorkspaceSubscription` only calls `auth.api.restoreSubscription()`, which handles pending cancellations. For scheduled downgrades (Pro → Starter via Subscription Schedule), we need to release the schedule instead.

- [ ] **Step 1: Write failing tests for schedule-aware reactivation**

Add tests to `apps/web/test/unit/billing/billing.server.test.ts`:

```typescript
describe('reactivateWorkspaceSubscription', () => {
  it('calls restoreSubscription for pending cancellation (no schedule)', async () => {
    // Mock listActiveSubscriptions with cancelAtPeriodEnd: true, no stripeScheduleId
    // Assert auth.api.restoreSubscription is called
  });

  it('calls releaseSubscriptionSchedule for scheduled downgrade', async () => {
    // Mock listActiveSubscriptions with stripeScheduleId: 'sub_sched_123'
    // Assert auth.billing.releaseSubscriptionSchedule('sub_sched_123') is called
    // Assert auth.api.restoreSubscription is NOT called
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @workspace/web test test/unit/billing/billing.server.test.ts`
Expected: FAIL — current implementation always calls `restoreSubscription`.

- [ ] **Step 3: Update `reactivateWorkspaceSubscription` to detect and handle both cases**

In `apps/web/src/billing/billing.server.ts`, update the function:

```typescript
export async function reactivateWorkspaceSubscription(
  headers: Headers,
  workspaceId: string
) {
  const subscriptions = await auth.api.listActiveSubscriptions({
    headers,
    query: { referenceId: workspaceId, customerType: 'organization' },
  });

  const active = subscriptions.filter(
    (s) => s.status === 'active' || s.status === 'trialing'
  );

  if (active.length === 0) {
    throw new Error('No active subscription found.');
  }

  const bestPlanId = resolveWorkspacePlanId(active);
  const target = active.find((s) => s.plan === bestPlanId);
  if (!target?.stripeSubscriptionId) {
    throw new Error('Could not find subscription to restore.');
  }

  // If the subscription has a schedule, release it (scheduled downgrade).
  // Otherwise, restore the subscription (pending cancellation).
  if (target.stripeScheduleId) {
    await auth.billing.releaseSubscriptionSchedule(target.stripeScheduleId);
  } else {
    await auth.api.restoreSubscription({
      headers,
      body: {
        subscriptionId: target.stripeSubscriptionId,
        referenceId: workspaceId,
        customerType: 'organization',
      },
    });
  }

  return { success: true };
}
```

Note: The `active.find()` result now needs `stripeScheduleId` — this comes from Task 2's changes to `resolveSubscriptionDetails`. However, `listActiveSubscriptions` returns raw subscription records which already include `stripeScheduleId` from the database schema.

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @workspace/web test test/unit/billing/billing.server.test.ts`
Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/billing/billing.server.ts apps/web/test/unit/billing/billing.server.test.ts
git commit -m "feat(billing): support reactivation for both cancellations and scheduled downgrades

Detect whether a subscription has a Stripe Schedule (downgrade) or
pending cancellation. Release the schedule or restore the subscription
accordingly."
```

---

## Task 5: Manage Plan Modal Component

**Files:**

- Create: `apps/web/src/components/billing/billing-manage-plan-dialog.tsx`
- Create: `apps/web/test/unit/billing/billing-manage-plan-dialog.test.tsx`

**Prereqs:** Task 1 (plan action utilities).

- [ ] **Step 1: Write failing tests for the modal**

Create `apps/web/test/unit/billing/billing-manage-plan-dialog.test.tsx`. Read existing component test files in `apps/web/test/unit/components/` to match the testing patterns (render helpers, mock setup).

Key test cases:

```typescript
describe('BillingManagePlanDialog', () => {
  it('renders all plans as cards', () => {
    // Render with currentPlan = pro
    // Expect 3 plan cards (Free, Starter, Pro)
  });

  it('shows "Current plan" disabled button for current plan', () => {
    // Render with currentPlan = pro
    // Pro card button should say "Current plan" and be disabled
  });

  it('shows "Upgrade" button for higher-tier plans', () => {
    // Render with currentPlan = starter
    // Pro card should have "Upgrade" button
  });

  it('shows "Downgrade" button for lower-tier plans', () => {
    // Render with currentPlan = pro
    // Starter and Free cards should have "Downgrade" buttons
  });

  it('calls onUpgrade when upgrade button is clicked', () => {
    // Render with currentPlan = free, mock onUpgrade
    // Click "Upgrade" on Starter card
    // Assert onUpgrade called with ('starter', false)
  });

  it('calls onDowngrade when downgrade button is clicked', () => {
    // Render with currentPlan = pro, mock onDowngrade
    // Click "Downgrade" on Starter card
    // Assert onDowngrade called with starter plan
  });

  it('shows monthly/annual toggle', () => {
    // Render with currentPlan = pro
    // Expect Monthly and Annual toggle buttons
  });

  it('disables all action buttons when isPendingCancel is true', () => {
    // Render with isPendingCancel = true
    // All downgrade/upgrade buttons should be disabled
    // A notice should be shown
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @workspace/web test test/unit/billing/billing-manage-plan-dialog.test.tsx`
Expected: FAIL — component not found.

- [ ] **Step 3: Implement the modal component**

Create `apps/web/src/components/billing/billing-manage-plan-dialog.tsx`:

The component should:

- Accept props: `open`, `onOpenChange`, `currentPlan`, `isPendingCancel`, `onUpgrade(planId, annual)`, `onDowngrade(targetPlan, annual)`, `isProcessing`
- Render a `Dialog` (from shadcn/ui) with title "Manage your plan" and subtitle "Current plan: {name}"
- Render a monthly/annual toggle (local state, defaults to monthly)
- Map over `PLANS` and render a card for each with:
  - Plan name, price (using `formatPlanPrice`), features (using `getPlanFeatures`)
  - Button with label/variant from `PLAN_ACTION_CONFIG[getPlanAction(currentPlan, plan)]`
  - Current plan button is disabled
- If `isPendingCancel`, show a notice and disable all non-current buttons
- Responsive: flex-row on desktop, flex-col on mobile

Use existing shadcn components: `Dialog`, `DialogContent`, `DialogHeader`, `DialogTitle`, `DialogDescription`, `Button`, `Toggle`, `Card`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @workspace/web test test/unit/billing/billing-manage-plan-dialog.test.tsx`
Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/billing/billing-manage-plan-dialog.tsx apps/web/test/unit/billing/billing-manage-plan-dialog.test.tsx
git commit -m "feat(billing): add Manage Plan modal component

Shows all plans side-by-side with upgrade/downgrade/current buttons.
Plan-agnostic — uses getPlanAction() for all action resolution."
```

---

## Task 6: Downgrade Confirmation Dialog

**Files:**

- Create: `apps/web/src/components/billing/billing-downgrade-confirm-dialog.tsx`
- Create: `apps/web/test/unit/billing/billing-downgrade-confirm-dialog.test.tsx`

**Prereqs:** Task 1 (plan action utilities — `computePlanDiff`).

- [ ] **Step 1: Write failing tests for the confirmation dialog**

Create `apps/web/test/unit/billing/billing-downgrade-confirm-dialog.test.tsx`:

```typescript
describe('BillingDowngradeConfirmDialog', () => {
  it('shows target plan name in title', () => {
    // Render with currentPlan = pro, targetPlan = starter
    // Expect "Downgrade to Starter?" in title
  });

  it('shows period end date', () => {
    // Render with periodEnd = new Date('2026-04-15')
    // Expect "April 15, 2026" in the dialog
  });

  it('shows lost features from computePlanDiff', () => {
    // Render with pro → starter
    // Expect "Email customer support" listed as lost feature
  });

  it('shows limit changes from computePlanDiff', () => {
    // Render with pro → starter
    // Expect "Member limit" change from 25 → 5
  });

  it('shows member count warning when current members exceed target limit', () => {
    // Render with pro → starter, currentMemberCount = 12
    // Expect warning about needing to remove members
  });

  it('does not show member warning when within limit', () => {
    // Render with pro → starter, currentMemberCount = 3
    // Expect no warning
  });

  it('calls onConfirm when confirm button is clicked', () => {
    // Mock onConfirm, click "Confirm downgrade"
    // Assert called
  });

  it('calls onCancel when cancel button is clicked', () => {
    // Mock onCancel, click "Cancel"
    // Assert called
  });

  it('disables confirm button when isProcessing', () => {
    // Render with isProcessing = true
    // Confirm button should be disabled
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @workspace/web test test/unit/billing/billing-downgrade-confirm-dialog.test.tsx`
Expected: FAIL — component not found.

- [ ] **Step 3: Implement the confirmation dialog**

Create `apps/web/src/components/billing/billing-downgrade-confirm-dialog.tsx`:

The component should:

- Accept props: `open`, `onOpenChange`, `currentPlan`, `targetPlan`, `periodEnd`, `currentMemberCount`, `onConfirm`, `isProcessing`
- Use `AlertDialog` from shadcn/ui (since this is a destructive confirmation)
- Title: "Downgrade to {targetPlan.name}?"
- Body: "Your {currentPlan.name} plan will remain active until {formatted date}. After that:"
- List lost features and limit changes from `computePlanDiff(currentPlan, targetPlan)`
- Show member count warning if `currentMemberCount > targetPlan.limits.maxMembers` and `targetPlan.limits.maxMembers !== -1`
- Footer: "Cancel" button and "Confirm downgrade" button (destructive variant)

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @workspace/web test test/unit/billing/billing-downgrade-confirm-dialog.test.tsx`
Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/billing/billing-downgrade-confirm-dialog.tsx apps/web/test/unit/billing/billing-downgrade-confirm-dialog.test.tsx
git commit -m "feat(billing): add downgrade confirmation dialog

Shows feature diff, limit changes, period end date, and member count
warning. Uses computePlanDiff() for plan-agnostic comparison."
```

---

## Task 7: Wire Everything into the Billing Page

**Files:**

- Modify: `apps/web/src/components/billing/billing-plan-cards.tsx`
- Modify: `apps/web/src/components/billing/billing-page.tsx`

**Prereqs:** Tasks 1-6.

- [ ] **Step 1: Update `billing-plan-cards.tsx`**

In `apps/web/src/components/billing/billing-plan-cards.tsx`:

1. Rename the `onManage` prop to `onManagePlan` in the interface and usage.
2. Change the button text from `'Manage subscription'` to `'Manage plan'` and the loading text from `'Opening portal...'` to `'Opening...'`.
3. Add a "Billing portal" text link below the "Manage plan" button. This preserves access to the Stripe Customer Portal for payment method management, address changes, etc. Add an `onBillingPortal` prop callback for this. Style as a subtle text link (`text-xs text-muted-foreground underline`).

- [ ] **Step 2: Update `billing-page.tsx` — add modal state and mutations**

In `apps/web/src/components/billing/billing-page.tsx`:

1. Add imports for new components and functions:

```typescript
import { BillingManagePlanDialog } from './billing-manage-plan-dialog';
import { BillingDowngradeConfirmDialog } from './billing-downgrade-confirm-dialog';
import {
  downgradeWorkspaceSubscription,
  cancelWorkspaceSubscription,
} from '@/billing/billing.functions';
import { getPlanById } from '@workspace/auth/plans';
import type { Plan } from '@workspace/auth/plans';
```

2. Add state for modal and confirmation dialog:

```typescript
const [managePlanOpen, setManagePlanOpen] = useState(false);
const [downgradeTarget, setDowngradeTarget] = useState<Plan | null>(null);
const [downgradeAnnual, setDowngradeAnnual] = useState(false);
```

3. Add downgrade mutation:

```typescript
const downgradeMutation = useMutation({
  mutationFn: ({ planId, annual, subscriptionId }: {
    planId: PlanId;
    annual: boolean;
    subscriptionId: string;
  }) => downgradeWorkspaceSubscription({
    data: { workspaceId, planId, annual, subscriptionId },
  }),
  onSuccess: () => {
    toast.success('Downgrade scheduled.');
    setDowngradeTarget(null);
    setManagePlanOpen(false);
    void queryClient.invalidateQueries({ queryKey: SESSION_QUERY_KEY });
    void queryClient.invalidateQueries({ queryKey: BILLING_DATA_QUERY_KEY });
  },
  onError: (error) => {
    toast.error(error.message || 'Failed to schedule downgrade.');
  },
});
```

4. Add cancel mutation:

```typescript
const cancelMutation = useMutation({
  mutationFn: () => cancelWorkspaceSubscription({ data: { workspaceId } }),
  onSuccess: () => {
    toast.success('Subscription will cancel at period end.');
    setDowngradeTarget(null);
    setManagePlanOpen(false);
    void queryClient.invalidateQueries({ queryKey: SESSION_QUERY_KEY });
    void queryClient.invalidateQueries({ queryKey: BILLING_DATA_QUERY_KEY });
  },
  onError: (error) => {
    toast.error(error.message || 'Failed to cancel subscription.');
  },
});
```

5. Wire up the `BillingPlanCards` `onManagePlan` to open the modal:

```typescript
<BillingPlanCards
  // ...existing props...
  onManagePlan={() => setManagePlanOpen(true)}
  onBillingPortal={() => manageMutation.mutate()}
/>
```

6. Add the modal and confirmation dialog to the JSX:

```typescript
<BillingManagePlanDialog
  open={managePlanOpen}
  onOpenChange={setManagePlanOpen}
  currentPlan={currentPlan}
  isPendingCancel={isPendingCancel}
  onUpgrade={(planId, annual) => {
    setManagePlanOpen(false);
    upgradeMutation.mutate({
      planId,
      annual,
      subscriptionId: subscription?.stripeSubscriptionId ?? undefined,
    });
  }}
  onDowngrade={(targetPlan, annual) => {
    setDowngradeTarget(targetPlan);
    setDowngradeAnnual(annual);
  }}
  isProcessing={upgradingPlanId !== null}
/>

{downgradeTarget && (
  <BillingDowngradeConfirmDialog
    open={!!downgradeTarget}
    onOpenChange={(open) => { if (!open) setDowngradeTarget(null); }}
    currentPlan={currentPlan}
    targetPlan={downgradeTarget}
    periodEnd={periodEnd}
    currentMemberCount={billingQuery.data.memberCount}
    onConfirm={() => {
      if (downgradeTarget.pricing === null) {
        cancelMutation.mutate();
      } else {
        downgradeMutation.mutate({
          planId: downgradeTarget.id,
          annual: downgradeAnnual,
          subscriptionId: subscription!.stripeSubscriptionId!,
        });
      }
    }}
    isProcessing={downgradeMutation.isPending || cancelMutation.isPending}
  />
)}
```

7. Update the downgrade banner to show the correct target plan name:

```typescript
{isPendingCancel && effectiveCancelDate && (
  <BillingDowngradeBanner
    targetPlanName={
      billingQuery.data.scheduledTargetPlanId
        ? (getPlanById(billingQuery.data.scheduledTargetPlanId)?.name ?? getFreePlan().name)
        : getFreePlan().name
    }
    periodEnd={effectiveCancelDate}
    onReactivate={() => reactivateMutation.mutate()}
    isReactivating={reactivateMutation.isPending}
  />
)}
```

- [ ] **Step 3: Run typecheck**

Run: `pnpm run typecheck`
Expected: No type errors.

- [ ] **Step 4: Run all unit tests**

Run: `pnpm test`
Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/billing/billing-plan-cards.tsx apps/web/src/components/billing/billing-page.tsx
git commit -m "feat(billing): wire manage plan modal and downgrade flow into billing page

- Rename 'Manage subscription' to 'Manage plan'
- Add downgrade and cancel mutations
- Connect modal → confirmation dialog → mutation flow
- Show correct target plan name in downgrade banner"
```

---

## Task 8: Final Verification

**Files:** None (verification only).

- [ ] **Step 1: Run full typecheck**

Run: `pnpm run typecheck`
Expected: No type errors.

- [ ] **Step 2: Run full lint**

Run: `pnpm run lint`
Expected: No lint errors (or only pre-existing ones).

- [ ] **Step 3: Run all unit and integration tests**

Run: `pnpm test`
Expected: All tests PASS.

- [ ] **Step 4: Verify the downgrade flow manually (if dev server is available)**

1. Start dev server: `pnpm dev`
2. Navigate to a workspace billing page as a Pro user.
3. Click "Manage plan" → modal opens with all plans.
4. Click "Downgrade" on Starter → confirmation dialog appears.
5. Confirm → toast shows success, modal closes, downgrade banner appears.
6. Click "Keep subscription" on banner → banner disappears.

- [ ] **Step 5: Commit any final fixes if needed**
