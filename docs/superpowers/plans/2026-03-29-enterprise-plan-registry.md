# Enterprise Plan Registry Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Support fully custom enterprise plans alongside existing self-serve tiers via a separate enterprise plan registry with hidden visibility.

**Architecture:** A new `visibility` field on the `Plan` interface controls whether plans appear in public billing UI. Enterprise plans live in a dedicated `enterprise-plans.ts` file and merge with self-serve plans into a unified `ALL_PLANS` array. All existing helpers switch to `ALL_PLANS`; UI components filter by `visibility: 'public'`.

**Tech Stack:** TypeScript, React 19, TanStack Query, shadcn/ui, Better Auth Stripe plugin, Vitest

**Spec:** `docs/superpowers/specs/2026-03-29-enterprise-plan-registry-design.md`

---

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `packages/auth/src/plans.ts` | Modify | Split `PlanId` type, add `visibility` to `Plan`, add `isEnterprisePlan()`, create `ALL_PLANS`, update all helpers |
| `packages/auth/src/enterprise-plans.ts` | Create | Enterprise plan registry (initially empty array) |
| `packages/auth/src/plan-actions.ts` | Modify | Switch `getDowngradePlans()` from `PLANS` to `ALL_PLANS` |
| `packages/auth/src/auth.server.ts` | Modify | Switch Stripe plan builder from `PLANS` to `ALL_PLANS` |
| `packages/auth/test/unit/plans.test.ts` | Modify | Add enterprise plan tests |
| `packages/auth/test/unit/plan-actions.test.ts` | Modify | Add enterprise plan tests |
| `apps/web/src/components/billing/billing-page.tsx` | Modify | Conditional render for enterprise vs self-serve |
| `apps/web/src/components/billing/billing-enterprise-plan-card.tsx` | Create | Simplified enterprise billing card |
| `apps/web/src/components/billing/billing-manage-plan-dialog.tsx` | Modify | Filter plans to `visibility: 'public'` |
| `apps/web/src/components/billing/upgrade-prompt-dialog.tsx` | Modify | Enterprise branch shows "contact account manager" |
| `apps/web/src/hooks/use-upgrade-prompt.ts` | Modify | Pass `isEnterprise` flag to dialog |

---

### Task 1: Add `visibility` field to Plan and split PlanId type

**Files:**
- Modify: `packages/auth/src/plans.ts`

- [ ] **Step 1: Write the failing test — `isEnterprisePlan` and `visibility` field**

Add to `packages/auth/test/unit/plans.test.ts`:

```ts
import {
  FREE_PLAN_ID,
  PLANS,
  ALL_PLANS,
  isEnterprisePlan,
  formatPlanPrice,
  getFreePlan,
  getHighestTierPlanId,
  getPlanById,
  getPlanFeatures,
  getPlanLimitsForPlanId,
  getUpgradePlan,
  getUpgradePlans,
  resolveWorkspacePlanId,
} from '../../src/plans';

// Add at the bottom of the file, after existing tests:

describe('isEnterprisePlan', () => {
  it('returns true for enterprise-prefixed IDs', () => {
    expect(isEnterprisePlan('enterprise-acme')).toBe(true);
    expect(isEnterprisePlan('enterprise-globex')).toBe(true);
  });

  it('returns false for self-serve plan IDs', () => {
    expect(isEnterprisePlan('free')).toBe(false);
    expect(isEnterprisePlan('starter')).toBe(false);
    expect(isEnterprisePlan('pro')).toBe(false);
  });

  it('returns false for empty string', () => {
    expect(isEnterprisePlan('')).toBe(false);
  });
});

describe('plan visibility', () => {
  it('all self-serve plans have public visibility', () => {
    for (const plan of PLANS) {
      expect(plan.visibility).toBe('public');
    }
  });

  it('ALL_PLANS includes all self-serve plans', () => {
    for (const plan of PLANS) {
      expect(ALL_PLANS.find((p) => p.id === plan.id)).toBeDefined();
    }
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter @workspace/auth test test/unit/plans.test.ts`

Expected: FAIL — `isEnterprisePlan` and `ALL_PLANS` are not exported from `plans.ts`.

- [ ] **Step 3: Update `PlanId` type, add `visibility` to `Plan`, add `isEnterprisePlan`, add `ALL_PLANS`**

In `packages/auth/src/plans.ts`, make these changes:

Replace the `PlanId` type (line 20):

```ts
// Before:
export type PlanId = 'free' | 'starter' | 'pro';

// After:
export type SelfServePlanId = 'free' | 'starter' | 'pro';
export type EnterprisePlanId = `enterprise-${string}`;
export type PlanId = SelfServePlanId | EnterprisePlanId;
```

Add `visibility` to the `Plan` interface (after `annualBonusFeatures`):

```ts
  /** Controls where this plan appears. 'public' = billing UI. 'hidden' = enterprise-only. */
  visibility: 'public' | 'hidden';
```

Add `visibility: 'public'` to each of the three plan entries in the `PLANS` array. For example the free plan becomes:

```ts
  {
    id: 'free',
    name: 'Free',
    tier: 0,
    pricing: null,
    limits: FREE_PLAN_LIMITS,
    features: [`${FREE_PLAN_LIMITS.maxMembers} member`],
    annualBonusFeatures: [],
    visibility: 'public',
  },
```

Do the same for `starter` and `pro`.

Add the enterprise plans import and `ALL_PLANS` after the `PLANS` array:

```ts
import { ENTERPRISE_PLANS } from './enterprise-plans';

/** All plans — self-serve + enterprise. Used by all resolution helpers. */
export const ALL_PLANS: ReadonlyArray<Plan> = [...PLANS, ...ENTERPRISE_PLANS];
```

Add the `isEnterprisePlan` helper at the bottom of the helpers section:

```ts
/** Returns true if the plan ID follows the enterprise naming convention. */
export function isEnterprisePlan(planId: string): boolean {
  return planId.startsWith('enterprise-');
}
```

- [ ] **Step 4: Create the enterprise plans registry file**

Create `packages/auth/src/enterprise-plans.ts`:

```ts
import type { Plan } from './plans';

// ────────────────────────────────────────────────────────────────────────────
// Enterprise plan registry — custom plans assigned to specific workspaces.
//
// Enterprise plans are hidden from the public billing UI and assigned
// manually via Stripe. Each entry follows the same Plan interface as
// self-serve plans but uses an `enterprise-` prefixed ID.
//
// To add a new enterprise plan:
//   1. Add an entry below with a unique `enterprise-<customer>` ID.
//   2. Create the corresponding product + prices in Stripe Dashboard.
//   3. Set STRIPE_ENTERPRISE_<CUSTOMER>_MONTHLY_PRICE_ID and
//      STRIPE_ENTERPRISE_<CUSTOMER>_ANNUAL_PRICE_ID env vars.
//   4. Deploy — limit enforcement and billing UI pick up the plan automatically.
// ────────────────────────────────────────────────────────────────────────────

export const ENTERPRISE_PLANS: ReadonlyArray<Plan> = [];
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `pnpm --filter @workspace/auth test test/unit/plans.test.ts`

Expected: All tests PASS, including the new `isEnterprisePlan` and `plan visibility` tests.

- [ ] **Step 6: Commit**

```bash
git add packages/auth/src/plans.ts packages/auth/src/enterprise-plans.ts packages/auth/test/unit/plans.test.ts
git commit -m "feat(auth): add plan visibility field, enterprise PlanId type, and isEnterprisePlan helper"
```

---

### Task 2: Switch plan helpers from `PLANS` to `ALL_PLANS`

**Files:**
- Modify: `packages/auth/src/plans.ts`
- Modify: `packages/auth/src/plan-actions.ts`
- Modify: `packages/auth/test/unit/plans.test.ts`
- Modify: `packages/auth/test/unit/plan-actions.test.ts`

- [ ] **Step 1: Write failing tests — enterprise plan resolution**

Add to `packages/auth/test/unit/plans.test.ts`, inside a new describe block at the bottom:

```ts
describe('enterprise plan resolution', () => {
  it('getPlanById resolves enterprise plan IDs from ALL_PLANS', () => {
    // When ENTERPRISE_PLANS is empty, this just confirms no crash.
    // When populated, it will resolve enterprise entries.
    const result = getPlanById('enterprise-test' as PlanId);
    expect(result).toBeUndefined();
  });

  it('getHighestTierPlanId picks enterprise over self-serve', () => {
    // With empty enterprise registry, should still resolve self-serve correctly.
    expect(getHighestTierPlanId(['starter', 'pro'])).toBe('pro');
  });

  it('resolveWorkspacePlanId handles unknown enterprise plan gracefully', () => {
    expect(
      resolveWorkspacePlanId([
        { plan: 'enterprise-unknown', status: 'active' },
      ])
    ).toBe(FREE_PLAN_ID);
  });
});
```

Add to `packages/auth/test/unit/plan-actions.test.ts`, at the bottom:

```ts
describe('getDowngradePlans with enterprise context', () => {
  it('returns self-serve plans below a high-tier plan', () => {
    const pro = getPlanById('pro')!;
    const downgrades = getDowngradePlans(pro);
    // Should still include starter and free.
    expect(downgrades.length).toBeGreaterThanOrEqual(2);
    expect(downgrades.map((p) => p.id)).toContain('starter');
    expect(downgrades.map((p) => p.id)).toContain('free');
  });
});
```

- [ ] **Step 2: Run both test files to verify they pass (baseline)**

Run: `pnpm --filter @workspace/auth test test/unit/plans.test.ts test/unit/plan-actions.test.ts`

Expected: All tests PASS (these are additive tests that should pass with current code since enterprise registry is empty).

- [ ] **Step 3: Switch helpers in `plans.ts` from `PLANS` to `ALL_PLANS`**

In `packages/auth/src/plans.ts`, update these functions:

`getPlanById` (line 103-105):
```ts
export function getPlanById(id: PlanId): Plan | undefined {
  return ALL_PLANS.find((p) => p.id === id);
}
```

`getPlanLimitsForPlanId` (line 117-120):
```ts
export function getPlanLimitsForPlanId(planId: PlanId): PlanLimits {
  const plan = ALL_PLANS.find((p) => p.id === planId);
  return plan?.limits ?? getFreePlan().limits;
}
```

`getHighestTierPlanId` (line 159-168):
```ts
export function getHighestTierPlanId(planIds: Array<string>): PlanId {
  let best: Plan | undefined;
  for (const id of planIds) {
    const plan = ALL_PLANS.find((p) => p.id === id);
    if (plan && (!best || plan.tier > best.tier)) {
      best = plan;
    }
  }
  return best?.id ?? FREE_PLAN_ID;
}
```

`getUpgradePlans` (line 173-177):
```ts
export function getUpgradePlans(currentPlan: Plan): Array<Plan> {
  return ALL_PLANS.filter((p) => p.tier > currentPlan.tier).sort(
    (a, b) => a.tier - b.tier
  );
}
```

- [ ] **Step 4: Switch `getDowngradePlans` in `plan-actions.ts` from `PLANS` to `ALL_PLANS`**

In `packages/auth/src/plan-actions.ts`, update the import (line 1):

```ts
// Before:
import { PLANS } from './plans';

// After:
import { ALL_PLANS } from './plans';
```

Update `getDowngradePlans` (line 33-37):

```ts
export function getDowngradePlans(currentPlan: Plan): Array<Plan> {
  return ALL_PLANS.filter((p) => p.tier < currentPlan.tier).sort(
    (a, b) => b.tier - a.tier
  );
}
```

- [ ] **Step 5: Run both test files to verify all tests pass**

Run: `pnpm --filter @workspace/auth test test/unit/plans.test.ts test/unit/plan-actions.test.ts`

Expected: All tests PASS.

- [ ] **Step 6: Update the existing test that checks plan count**

The existing test `'exports exactly three plans'` checks `PLANS` length. It should remain unchanged since `PLANS` still has exactly 3 self-serve plans. Verify by reading the test output — if it passed in step 5, no change needed.

- [ ] **Step 7: Commit**

```bash
git add packages/auth/src/plans.ts packages/auth/src/plan-actions.ts packages/auth/test/unit/plans.test.ts packages/auth/test/unit/plan-actions.test.ts
git commit -m "refactor(auth): switch plan helpers from PLANS to ALL_PLANS for enterprise support"
```

---

### Task 3: Update Stripe plugin configuration in `auth.server.ts`

**Files:**
- Modify: `packages/auth/src/auth.server.ts:20,86-93`

- [ ] **Step 1: Update the import to use `ALL_PLANS`**

In `packages/auth/src/auth.server.ts`, line 20, change:

```ts
// Before:
import { PLANS, getPlanLimitsForPlanId } from './plans';

// After:
import { ALL_PLANS, getPlanLimitsForPlanId } from './plans';
```

- [ ] **Step 2: Update the Stripe plan builder to use `ALL_PLANS`**

In `packages/auth/src/auth.server.ts`, lines 85-93, change:

```ts
// Before:
  // Build Stripe plan config from PLANS — reads price IDs from process.env.
  const stripePlans = PLANS.filter((p) => p.pricing !== null).map((p) => {
    const key = p.id.toUpperCase();

// After:
  // Build Stripe plan config from ALL_PLANS — reads price IDs from process.env.
  const stripePlans = ALL_PLANS.filter((p) => p.pricing !== null).map((p) => {
    const key = p.id.toUpperCase().replace(/-/g, '_');
```

Note the `.replace(/-/g, '_')` — this converts `enterprise-acme` to `ENTERPRISE_ACME` for the env var lookup (`STRIPE_ENTERPRISE_ACME_MONTHLY_PRICE_ID`). The existing self-serve plans (`starter`, `pro`) have no hyphens, so this is a no-op for them.

- [ ] **Step 3: Run typecheck to verify no compile errors**

Run: `pnpm --filter @workspace/auth typecheck`

Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add packages/auth/src/auth.server.ts
git commit -m "feat(auth): update Stripe plan builder to include enterprise plans"
```

---

### Task 4: Update `@workspace/auth` barrel export

**Files:**
- Modify: `packages/auth/src/index.ts`

- [ ] **Step 1: Add new type exports to the barrel**

In `packages/auth/src/index.ts`, update the plans type export (line 11):

```ts
// Before:
export type { PlanId, Plan, PlanLimits, PlanPricing } from './plans';

// After:
export type {
  PlanId,
  SelfServePlanId,
  EnterprisePlanId,
  Plan,
  PlanLimits,
  PlanPricing,
} from './plans';
```

- [ ] **Step 2: Run typecheck**

Run: `pnpm --filter @workspace/auth typecheck`

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add packages/auth/src/index.ts
git commit -m "feat(auth): export new enterprise plan types from barrel"
```

---

### Task 5: Create `BillingEnterprisePlanCard` component

**Files:**
- Create: `apps/web/src/components/billing/billing-enterprise-plan-card.tsx`

- [ ] **Step 1: Create the enterprise plan card component**

Create `apps/web/src/components/billing/billing-enterprise-plan-card.tsx`:

```tsx
import { IconCheck } from '@tabler/icons-react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@workspace/ui/components/card';
import type { Plan } from '@workspace/auth/plans';

const DATE_FORMAT = new Intl.DateTimeFormat('en-US', {
  month: 'long',
  day: 'numeric',
  year: 'numeric',
});

interface BillingEnterprisePlanCardProps {
  currentPlan: Plan;
  /** Next billing date. null if no active subscription. */
  nextBillingDate: Date | null;
  /** Current number of members in the workspace. */
  memberCount: number;
}

export function BillingEnterprisePlanCard({
  currentPlan,
  nextBillingDate,
  memberCount,
}: BillingEnterprisePlanCardProps) {
  const memberLimit = currentPlan.limits.maxMembers;
  const memberDisplay =
    memberLimit === -1
      ? `${memberCount} members (unlimited)`
      : `${memberCount} / ${memberLimit} members`;

  return (
    <Card>
      <CardHeader>
        <CardDescription>Current plan</CardDescription>
        <CardTitle className="text-2xl">{currentPlan.name}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <p className="text-sm font-medium">{memberDisplay}</p>
        {nextBillingDate && (
          <p className="text-sm text-muted-foreground">
            Renews on {DATE_FORMAT.format(nextBillingDate)}
          </p>
        )}
        <ul className="mt-1 flex flex-col gap-2">
          {currentPlan.features.map((feature) => (
            <li key={feature} className="flex items-center gap-2 text-sm">
              <IconCheck className="size-3.5 shrink-0 text-muted-foreground" />
              {feature}
            </li>
          ))}
        </ul>
        <p className="mt-2 text-sm text-muted-foreground">
          Contact your account manager to modify your plan.
        </p>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 2: Run typecheck to verify the component compiles**

Run: `pnpm --filter @workspace/web typecheck`

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/billing/billing-enterprise-plan-card.tsx
git commit -m "feat(billing): add BillingEnterprisePlanCard component for enterprise workspaces"
```

---

### Task 6: Update `BillingPage` for enterprise conditional rendering

**Files:**
- Modify: `apps/web/src/components/billing/billing-page.tsx`

- [ ] **Step 1: Add enterprise imports and conditional rendering**

In `apps/web/src/components/billing/billing-page.tsx`, add to the imports (after the existing `@workspace/auth/plans` imports):

```ts
import { isEnterprisePlan } from '@workspace/auth/plans';
import { BillingEnterprisePlanCard } from './billing-enterprise-plan-card';
```

Update the `getUpgradePlans` call (line 189) to filter by visibility:

```ts
// Before:
  const upgradePlans = getUpgradePlans(currentPlan);

// After:
  const isEnterprise = isEnterprisePlan(currentPlan.id);
  const upgradePlans = getUpgradePlans(currentPlan).filter(
    (p) => p.visibility === 'public'
  );
```

Replace the JSX return block (lines 205-298) to conditionally render for enterprise. The enterprise path shows the enterprise card and invoice table only; the self-serve path is unchanged:

```tsx
  return (
    <div className={PAGE_LAYOUT_CLASS}>
      {isEnterprise ? (
        <>
          <BillingEnterprisePlanCard
            currentPlan={currentPlan}
            nextBillingDate={periodEnd}
            memberCount={billingQuery.data.memberCount}
          />

          <Card>
            <CardContent>
              <BillingInvoiceTable
                invoices={invoicesQuery.data ?? []}
                isLoading={invoicesQuery.isLoading}
              />
            </CardContent>
          </Card>
        </>
      ) : (
        <>
          {(isPendingCancel || isPendingDowngrade) && effectiveCancelDate && (
            <BillingDowngradeBanner
              targetPlanName={
                billingQuery.data.scheduledTargetPlanId
                  ? (getPlanById(billingQuery.data.scheduledTargetPlanId)
                      ?.name ?? getFreePlan().name)
                  : getFreePlan().name
              }
              periodEnd={effectiveCancelDate}
              onReactivate={() => reactivateMutation.mutate()}
              isReactivating={reactivateMutation.isPending}
            />
          )}

          <BillingPlanCards
            currentPlan={currentPlan}
            upgradePlans={upgradePlans}
            nextBillingDate={periodEnd}
            annualByPlan={annualByPlan}
            onToggleInterval={(planId, annual) =>
              setAnnualByPlan((prev) => ({ ...prev, [planId]: annual }))
            }
            onManagePlan={() => setManagePlanOpen(true)}
            onUpgrade={(planId, annual) =>
              upgradeMutation.mutate({
                planId,
                annual,
                subscriptionId:
                  subscription?.stripeSubscriptionId ?? undefined,
              })
            }
            onBillingPortal={() => manageMutation.mutate()}
            isManaging={manageMutation.isPending}
            isBillingPortalLoading={manageMutation.isPending}
            upgradingPlanId={upgradingPlanId}
          />

          <BillingManagePlanDialog
            open={managePlanOpen}
            onOpenChange={setManagePlanOpen}
            currentPlan={currentPlan}
            isPendingCancel={isPendingCancel}
            isPendingDowngrade={isPendingDowngrade}
            onUpgrade={(planId, annual) => {
              setManagePlanOpen(false);
              upgradeMutation.mutate({
                planId,
                annual,
                subscriptionId:
                  subscription?.stripeSubscriptionId ?? undefined,
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
              onOpenChange={(open) => {
                if (!open) setDowngradeTarget(null);
              }}
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
                    subscriptionId:
                      subscription!.stripeSubscriptionId!,
                  });
                }
              }}
              isProcessing={
                downgradeMutation.isPending || cancelMutation.isPending
              }
            />
          )}

          <Card>
            <CardContent>
              <BillingInvoiceTable
                invoices={invoicesQuery.data ?? []}
                isLoading={invoicesQuery.isLoading}
              />
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
```

- [ ] **Step 2: Run typecheck**

Run: `pnpm --filter @workspace/web typecheck`

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/billing/billing-page.tsx
git commit -m "feat(billing): conditionally render enterprise vs self-serve billing page"
```

---

### Task 7: Filter enterprise plans from `BillingManagePlanDialog`

**Files:**
- Modify: `apps/web/src/components/billing/billing-manage-plan-dialog.tsx:4-10,104`

- [ ] **Step 1: Update the import and filter to public plans**

In `apps/web/src/components/billing/billing-manage-plan-dialog.tsx`, update the import (lines 4-10):

```ts
// Before:
import {
  PLANS,
  PLAN_ACTION_CONFIG,
  formatPlanPrice,
  getPlanAction,
  getPlanFeatures,
} from '@workspace/auth/plans';

// After:
import {
  ALL_PLANS,
  PLAN_ACTION_CONFIG,
  formatPlanPrice,
  getPlanAction,
  getPlanFeatures,
} from '@workspace/auth/plans';
```

Update the plans loop (line 104):

```tsx
// Before:
          {PLANS.map((plan) => {

// After:
          {ALL_PLANS.filter((p) => p.visibility === 'public').map((plan) => {
```

- [ ] **Step 2: Run typecheck**

Run: `pnpm --filter @workspace/web typecheck`

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/billing/billing-manage-plan-dialog.tsx
git commit -m "refactor(billing): filter enterprise plans from manage plan dialog"
```

---

### Task 8: Update `UpgradePromptDialog` for enterprise workspaces

**Files:**
- Modify: `apps/web/src/components/billing/upgrade-prompt-dialog.tsx`
- Modify: `apps/web/src/hooks/use-upgrade-prompt.ts`

- [ ] **Step 1: Add `isEnterprise` prop to `UpgradePromptDialog`**

In `apps/web/src/components/billing/upgrade-prompt-dialog.tsx`, add to the interface (after line 24):

```ts
  /** When true, shows enterprise contact message instead of upgrade offer. */
  isEnterprise?: boolean;
```

Add `isEnterprise` to the destructured props (line 37):

```tsx
// Before:
}: UpgradePromptDialogProps) {

// After:
  isEnterprise,
}: UpgradePromptDialogProps) {
```

Update the fallback branch (lines 125-136) to handle three states instead of two. Replace the entire ternary content inside `<div className="flex flex-col gap-6 p-7">` (lines 52-136):

```tsx
        <div className="flex flex-col gap-6 p-7">
          {isEnterprise ? (
            /* Enterprise workspace — no self-serve upgrade path. */
            <div className="flex flex-col items-center gap-3 pt-1">
              <p className="text-center text-sm text-muted-foreground">
                You've reached the limits of your current plan. Contact your
                account manager to increase your plan limits.
              </p>
              <AlertDialogCancel variant="outline" size="sm" className="mt-2">
                Got it
              </AlertDialogCancel>
            </div>
          ) : upgradePlan ? (
            <>
              {/* Plan name + price + toggle */}
              <div className="flex flex-col gap-4">
                <div className="flex items-baseline gap-2">
                  <h3 className="text-xl font-semibold tracking-tight">
                    {upgradePlan.name}
                  </h3>
                  {upgradePlan.pricing && (
                    <span className="text-sm text-muted-foreground">
                      {formatPlanPrice(upgradePlan, isAnnual)}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-0.5 self-start rounded-full border p-0.5">
                  <Toggle
                    pressed={!isAnnual}
                    onPressedChange={() => onToggleInterval(false)}
                    size="sm"
                    className="h-6 rounded-full px-2.5 text-xs aria-pressed:bg-foreground aria-pressed:text-background"
                    aria-label="Monthly billing"
                  >
                    Monthly
                  </Toggle>
                  <Toggle
                    pressed={isAnnual}
                    onPressedChange={() => onToggleInterval(true)}
                    size="sm"
                    className="h-6 rounded-full px-2.5 text-xs aria-pressed:bg-foreground aria-pressed:text-background"
                    aria-label="Annual billing"
                  >
                    Annual
                  </Toggle>
                </div>
              </div>

              {/* Features */}
              <ul className="flex flex-col gap-2.5">
                {getPlanFeatures(upgradePlan, isAnnual).map((feature) => (
                  <li
                    key={feature}
                    className="flex items-center gap-2.5 text-sm"
                  >
                    <IconCheck className="size-3.5 shrink-0 text-primary" />
                    {feature}
                  </li>
                ))}
              </ul>

              {/* Actions */}
              <div className="flex flex-col items-center gap-3 pt-1">
                <Button
                  className="w-full"
                  disabled={isUpgrading}
                  onClick={onUpgrade}
                >
                  {isUpgrading && (
                    <IconLoader2 className="size-4 animate-spin" />
                  )}
                  Upgrade to {upgradePlan.name}
                </Button>
                <AlertDialogCancel
                  variant="link"
                  size="sm"
                  disabled={isUpgrading}
                  className="h-auto border-0 px-0 py-1 text-xs text-muted-foreground shadow-none"
                >
                  Maybe later
                </AlertDialogCancel>
              </div>
            </>
          ) : (
            /* Limit-reached message — no upgrade available. */
            <div className="flex flex-col items-center gap-3 pt-1">
              <p className="text-center text-sm text-muted-foreground">
                You've reached the limits of your current plan. Contact us for a
                custom plan tailored to your needs.
              </p>
              <AlertDialogCancel variant="outline" size="sm" className="mt-2">
                Got it
              </AlertDialogCancel>
            </div>
          )}
        </div>
```

- [ ] **Step 2: Update `useUpgradePrompt` to pass `isEnterprise`**

In `apps/web/src/hooks/use-upgrade-prompt.ts`, add the import (after line 4):

```ts
import { isEnterprisePlan } from '@workspace/auth/plans';
```

Add a `currentPlanId` parameter to the hook (line 30):

```ts
// Before:
export function useUpgradePrompt(workspaceId: string) {

// After:
export function useUpgradePrompt(workspaceId: string, currentPlanId: string) {
```

Add `isEnterprise` to the `dialogProps` object (after line 71, before the closing `}`):

```ts
    isEnterprise: isEnterprisePlan(currentPlanId),
```

- [ ] **Step 3: Update callers of `useUpgradePrompt` to pass `currentPlanId`**

Search for usages of `useUpgradePrompt` and update them to pass the current plan ID. The hook is used in workspace components that have access to the current plan. Each call site needs to pass the plan ID as the second argument.

Run: `grep -rn 'useUpgradePrompt' apps/web/src/` to find all call sites and update each one.

- [ ] **Step 4: Run typecheck**

Run: `pnpm --filter @workspace/web typecheck`

Expected: No errors.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/billing/upgrade-prompt-dialog.tsx apps/web/src/hooks/use-upgrade-prompt.ts
git commit -m "feat(billing): show enterprise contact message in upgrade prompt dialog"
```

---

### Task 9: Update `@workspace/auth/plans` export path

**Files:**
- Modify: `packages/auth/src/plans.ts` (re-exports at bottom)

- [ ] **Step 1: Verify `ALL_PLANS` and `isEnterprisePlan` are exported from the `plans` export path**

The `@workspace/auth/plans` export path maps to `./src/plans.ts` (see `packages/auth/package.json` line 12). Since `ALL_PLANS` and `isEnterprisePlan` are already exported from `plans.ts` (added in Task 1), they're automatically available via `@workspace/auth/plans`. No change needed.

Verify by running: `pnpm --filter @workspace/web typecheck`

Expected: No errors. The imports added in Tasks 6-8 should resolve.

- [ ] **Step 2: Commit (if any adjustments were needed)**

If typecheck passed with no changes, skip this commit.

---

### Task 10: Full verification

**Files:** None (verification only)

- [ ] **Step 1: Run all auth package tests**

Run: `pnpm --filter @workspace/auth test`

Expected: All tests pass.

- [ ] **Step 2: Run web app typecheck**

Run: `pnpm --filter @workspace/web typecheck`

Expected: No errors.

- [ ] **Step 3: Run full monorepo lint**

Run: `pnpm run lint`

Expected: No new lint errors.

- [ ] **Step 4: Run full monorepo typecheck**

Run: `pnpm run typecheck`

Expected: No errors.

- [ ] **Step 5: Run full test suite**

Run: `pnpm test`

Expected: All tests pass.
