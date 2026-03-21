# Billing Page Vertical Layout Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the billing page from a horizontal 2-column grid to a vertical stack showing all upgrade plans.

**Architecture:** Add `getUpgradePlans()` helper to the plans package, update `BillingPlanCards` to accept and render an array of upgrade plans with per-card billing toggles, and update `BillingPage` to manage per-plan annual state.

**Tech Stack:** React 19, TanStack Query, TypeScript, Tailwind CSS, Vitest

**Spec:** `docs/superpowers/specs/2026-03-20-billing-page-vertical-layout-design.md`

---

## Chunk 1: Data Layer + Tests

### Task 1: Add `getUpgradePlans` test

**Files:**

- Modify: `packages/auth/test/unit/plans.test.ts`

- [ ] **Step 1: Write the failing tests**

Add a new `describe` block after the existing `getUpgradePlan` block (after line 92):

```ts
describe('getUpgradePlans', () => {
  it('returns all higher-tier plans for free plan', () => {
    const free = getPlanById('free')!;
    const upgrades = getUpgradePlans(free);
    expect(upgrades).toHaveLength(2);
    expect(upgrades[0].id).toBe('starter');
    expect(upgrades[1].id).toBe('pro');
  });

  it('returns only pro for starter plan', () => {
    const starter = getPlanById('starter')!;
    const upgrades = getUpgradePlans(starter);
    expect(upgrades).toHaveLength(1);
    expect(upgrades[0].id).toBe('pro');
  });

  it('returns empty array for highest tier plan', () => {
    const pro = getPlanById('pro')!;
    const upgrades = getUpgradePlans(pro);
    expect(upgrades).toHaveLength(0);
  });
});
```

Also add `getUpgradePlans` to the import on line 1:

```ts
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
  getUpgradePlans,
  resolveUserPlanId,
} from '../../src/plans';
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @workspace/auth test test/unit/plans.test.ts`
Expected: FAIL — `getUpgradePlans` is not exported from `../../src/plans`

### Task 2: Implement `getUpgradePlans`

**Files:**

- Modify: `packages/auth/src/plans.ts:176-182` (after `getUpgradePlan`)

- [ ] **Step 3: Write implementation**

Add after the existing `getUpgradePlan` function (after line 182):

```ts
/**
 * Returns all plans above the current plan's tier, sorted by tier ascending.
 */
export function getUpgradePlans(currentPlan: Plan): Array<Plan> {
  return PLANS.filter((p) => p.tier > currentPlan.tier).sort(
    (a, b) => a.tier - b.tier
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @workspace/auth test test/unit/plans.test.ts`
Expected: ALL PASS

- [ ] **Step 5: Commit**

```bash
git add packages/auth/src/plans.ts packages/auth/test/unit/plans.test.ts
git commit -m "feat(auth): add getUpgradePlans helper for multi-plan upgrade UI"
```

---

## Chunk 2: Update BillingPlanCards Component

### Task 3: Update `BillingPlanCards` interface and rendering

**Files:**

- Modify: `apps/web/src/components/billing/billing-plan-cards.tsx`

- [ ] **Step 6: Update the interface**

Replace the current `BillingPlanCardsProps` interface (lines 15-27) with:

```ts
interface BillingPlanCardsProps {
  currentPlan: Plan;
  upgradePlans: Array<Plan>;
  /** Next billing date for paid plans. null for free tier. */
  nextBillingDate: Date | null;
  /** Per-plan annual toggle state. Missing keys default to monthly. */
  annualByPlan: Record<PlanId, boolean>;
  onToggleInterval: (planId: PlanId, annual: boolean) => void;
  onManage: () => void;
  onUpgrade: (planId: PlanId, annual: boolean) => void;
  isManaging: boolean;
  /** The plan ID currently being upgraded, or null if no checkout in progress. */
  upgradingPlanId: PlanId | null;
}
```

- [ ] **Step 7: Update the component function signature and body**

Replace the entire component function (lines 35-159) with:

```tsx
export function BillingPlanCards({
  currentPlan,
  upgradePlans,
  nextBillingDate,
  annualByPlan,
  onToggleInterval,
  onManage,
  onUpgrade,
  isManaging,
  upgradingPlanId,
}: BillingPlanCardsProps) {
  return (
    <div className="flex flex-col gap-4">
      {/* Current Plan Card */}
      <Card>
        <CardHeader>
          <CardDescription>Current plan</CardDescription>
          <CardTitle className="text-2xl">{currentPlan.name}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <p className="text-sm text-muted-foreground">
            {!currentPlan.pricing
              ? 'Free forever'
              : formatPlanPrice(currentPlan, false)}
          </p>
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
        </CardContent>
        {currentPlan.pricing && (
          <CardFooter>
            <Button
              variant="outline"
              className="w-full"
              onClick={onManage}
              disabled={isManaging}
            >
              {isManaging ? 'Opening portal...' : 'Manage subscription'}
            </Button>
          </CardFooter>
        )}
      </Card>

      {/* Upgrade Cards */}
      {upgradePlans.length > 0 ? (
        upgradePlans.map((plan) => {
          const isAnnual = annualByPlan[plan.id] ?? false;
          const isThisPlanUpgrading = upgradingPlanId === plan.id;

          return (
            <Card key={plan.id}>
              <CardHeader>
                <CardDescription>Upgrade to</CardDescription>
                <CardTitle className="text-2xl">{plan.name}</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                <div className="flex items-center gap-2">
                  {plan.pricing && (
                    <p className="text-sm font-medium">
                      {formatPlanPrice(plan, isAnnual)}
                    </p>
                  )}
                  <div className="flex items-center gap-0.5 rounded-full border p-0.5">
                    <Toggle
                      pressed={!isAnnual}
                      onPressedChange={() => onToggleInterval(plan.id, false)}
                      size="sm"
                      className="h-6 rounded-full px-2.5 text-xs aria-pressed:bg-foreground aria-pressed:text-background"
                      aria-label="Monthly billing"
                    >
                      Monthly
                    </Toggle>
                    <Toggle
                      pressed={isAnnual}
                      onPressedChange={() => onToggleInterval(plan.id, true)}
                      size="sm"
                      className="h-6 rounded-full px-2.5 text-xs aria-pressed:bg-foreground aria-pressed:text-background"
                      aria-label="Annual billing"
                    >
                      Annual
                    </Toggle>
                  </div>
                </div>
                <ul className="mt-1 flex flex-col gap-2">
                  {getPlanFeatures(plan, isAnnual).map((feature) => (
                    <li
                      key={feature}
                      className="flex items-center gap-2 text-sm"
                    >
                      <IconCheck className="size-3.5 shrink-0 text-primary" />
                      {feature}
                    </li>
                  ))}
                </ul>
              </CardContent>
              <CardFooter>
                <Button
                  className="w-full"
                  onClick={() => onUpgrade(plan.id, isAnnual)}
                  disabled={upgradingPlanId !== null}
                >
                  {isThisPlanUpgrading
                    ? 'Redirecting...'
                    : `Upgrade to ${plan.name}`}
                </Button>
              </CardFooter>
            </Card>
          );
        })
      ) : (
        <Card>
          <CardHeader>
            <CardDescription>Need more?</CardDescription>
            <CardTitle className="text-2xl">Custom plan</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              You're on our best plan. Contact us for a custom plan tailored to
              your needs.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
```

- [ ] **Step 8: Commit**

```bash
git add apps/web/src/components/billing/billing-plan-cards.tsx
git commit -m "feat(billing): update BillingPlanCards to vertical layout with multiple upgrade plans"
```

---

## Chunk 3: Update BillingPage Parent Component

### Task 4: Update `BillingPage` state management and props

**Files:**

- Modify: `apps/web/src/components/billing/billing-page.tsx`

- [ ] **Step 9: Update imports**

Replace line 4:

```ts
import { getUpgradePlan } from '@workspace/auth/plans';
```

with:

```ts
import { getUpgradePlans } from '@workspace/auth/plans';
```

- [ ] **Step 10: Update state and mutation tracking**

Replace line 27:

```ts
const [isAnnual, setIsAnnual] = useState(false);
```

with:

```ts
const [annualByPlan, setAnnualByPlan] = useState<Record<PlanId, boolean>>({});
const [upgradingPlanId, setUpgradingPlanId] = useState<PlanId | null>(null);
```

- [ ] **Step 11: Update upgradeMutation to track which plan is upgrading**

Replace the `upgradeMutation` (lines 51-62) with:

```ts
const upgradeMutation = useMutation({
  mutationFn: ({ planId, annual }: { planId: PlanId; annual: boolean }) =>
    createCheckoutSession({ data: { planId, annual } }),
  onMutate: ({ planId }) => {
    setUpgradingPlanId(planId);
  },
  onSuccess: (result) => {
    if (result.url) {
      window.location.href = result.url;
    }
  },
  onError: (error) => {
    toast.error(error.message || 'Failed to start checkout.');
  },
  onSettled: () => {
    setUpgradingPlanId(null);
  },
});
```

- [ ] **Step 12: Update derived data**

Replace line 79:

```ts
const upgradePlan = getUpgradePlan(currentPlan);
```

with:

```ts
const upgradePlans = getUpgradePlans(currentPlan);
```

- [ ] **Step 13: Update BillingPlanCards props**

Replace the `<BillingPlanCards ... />` JSX (lines 102-114) with:

```tsx
<BillingPlanCards
  currentPlan={currentPlan}
  upgradePlans={upgradePlans}
  nextBillingDate={periodEnd}
  annualByPlan={annualByPlan}
  onToggleInterval={(planId, annual) =>
    setAnnualByPlan((prev) => ({ ...prev, [planId]: annual }))
  }
  onManage={() => manageMutation.mutate()}
  onUpgrade={(planId, annual) => upgradeMutation.mutate({ planId, annual })}
  isManaging={manageMutation.isPending}
  upgradingPlanId={upgradingPlanId}
/>
```

- [ ] **Step 14: Commit**

```bash
git add apps/web/src/components/billing/billing-page.tsx
git commit -m "feat(billing): update BillingPage to pass all upgrade plans with per-plan state"
```

---

## Chunk 4: Verification

### Task 5: Verify the build

- [ ] **Step 15: Run typecheck**

Run: `pnpm run typecheck`
Expected: No errors

- [ ] **Step 16: Run lint**

Run: `pnpm run lint`
Expected: No errors (or only pre-existing warnings)

- [ ] **Step 17: Run all tests**

Run: `pnpm test`
Expected: ALL PASS

- [ ] **Step 18: Run format**

Run: `pnpm run format`
Expected: Files formatted

- [ ] **Step 19: Final commit if formatting changed files**

```bash
git add -A
git commit -m "style: format billing layout changes"
```
