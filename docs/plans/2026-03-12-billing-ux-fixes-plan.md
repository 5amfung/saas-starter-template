# Billing UX Fixes Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix the billing page showing wrong current plan, make the upgrade prompt tier-aware, and handle highest-tier users gracefully.

**Architecture:** Extract `getUpgradePlan` to `plans.ts` as a shared pure function. Create `getUserBillingData` server function for the billing page. Extend `checkPlanLimit` to return upgrade plan info. Make `UpgradePromptDialog` and `useUpgradePrompt` accept dynamic plan data instead of hardcoded Pro references.

**Tech Stack:** TanStack Start (server functions), TanStack Query, React, Zod v4, Vitest

**Design doc:** `docs/plans/2026-03-12-billing-ux-fixes-design.md`

---

### Task 1: Extract `getUpgradePlan` to `plans.ts`

The `getUpgradePlan` function currently lives as a local function in `billing-page.tsx:31-49`. It's a pure function that should be shared — both the billing page and `checkPlanLimit` need it.

**Files:**

- Modify: `src/billing/plans.ts` — add `getUpgradePlan` function
- Modify: `src/billing/plans.test.ts` — add tests
- Modify: `src/components/billing/billing-page.tsx:31-49` — remove local copy, import from `plans.ts`

**Step 1: Write failing tests for `getUpgradePlan`**

Add to `src/billing/plans.test.ts`:

```ts
import {
  // ... existing imports ...
  getUpgradePlan,
} from '@/billing/plans';

describe('getUpgradePlan', () => {
  it('returns next tier plan for starter (monthly)', () => {
    const starter = getPlanById('starter')!;
    const upgrade = getUpgradePlan(starter, false);
    expect(upgrade).toBeDefined();
    expect(upgrade!.id).toBe('pro-monthly');
  });

  it('returns next tier plan for starter (annual)', () => {
    const starter = getPlanById('starter')!;
    const upgrade = getUpgradePlan(starter, true);
    expect(upgrade).toBeDefined();
    expect(upgrade!.id).toBe('pro-annual');
  });

  it('returns null for highest tier plan', () => {
    const pro = getPlanById('pro-monthly')!;
    const upgrade = getUpgradePlan(pro, false);
    expect(upgrade).toBeNull();
  });

  it('returns null for highest tier plan (annual variant)', () => {
    const pro = getPlanById('pro-annual')!;
    const upgrade = getUpgradePlan(pro, true);
    expect(upgrade).toBeNull();
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `bun test src/billing/plans.test.ts`
Expected: FAIL — `getUpgradePlan` is not exported from `@/billing/plans`

**Step 3: Implement `getUpgradePlan` in `plans.ts`**

Add to `src/billing/plans.ts` at the end of the file:

```ts
/**
 * Returns the next upgrade plan for a given plan (next tier up), or null
 * if the user is already on the highest tier.
 * Picks the monthly or annual variant based on the `annual` flag.
 */
export function getUpgradePlan(
  currentPlan: Plan,
  annual: boolean,
): Plan | null {
  const higherTierPlans = PLANS.filter((p) => p.tier > currentPlan.tier).sort(
    (a, b) => a.tier - b.tier,
  );
  if (higherTierPlans.length === 0) return null;

  const nextTierPlan = higherTierPlans[0];
  const nextGroup = PLAN_GROUP[nextTierPlan.id];
  return (
    PLANS.find(
      (p) =>
        PLAN_GROUP[p.id] === nextGroup &&
        p.interval === (annual ? 'year' : 'month'),
    ) ?? nextTierPlan
  );
}
```

**Step 4: Run tests to verify they pass**

Run: `bun test src/billing/plans.test.ts`
Expected: ALL PASS

**Step 5: Remove local `getUpgradePlan` from `billing-page.tsx`**

In `src/components/billing/billing-page.tsx`:

- Remove the local `getUpgradePlan` function (lines 31-49)
- Add `getUpgradePlan` to the import from `@/billing/plans` (line 14-17 area)

**Step 6: Run typecheck**

Run: `bun run typecheck`
Expected: No errors

**Step 7: Commit**

```bash
git add src/billing/plans.ts src/billing/plans.test.ts src/components/billing/billing-page.tsx
git commit -m "refactor(billing): extract getUpgradePlan to plans.ts as shared helper"
```

---

### Task 2: Create `getUserBillingData` server function

This fixes the root cause — the billing page will get real subscription data from the DB instead of the nonexistent `session.user.subscription`.

**Files:**

- Modify: `src/billing/billing.server.ts` — add `getUserSubscriptionDetails` helper
- Modify: `src/billing/billing.functions.ts` — add `getUserBillingData` server function

**Step 1: Add `getUserSubscriptionDetails` to `billing.server.ts`**

This queries the subscription table for the active subscription's display details.

```ts
import {
  subscription as subscriptionTable,
  // ... existing imports ...
} from '@/db/schema';

/**
 * Returns the active subscription details for a user, or null if on the free tier.
 * Picks the subscription matching the user's highest-tier plan.
 */
export async function getUserSubscriptionDetails(
  userId: string,
  planId: PlanId,
): Promise<{
  status: string;
  periodEnd: Date | null;
  cancelAtPeriodEnd: boolean;
} | null> {
  // The plan name stored in the subscription table is the Better Auth group
  // name (e.g. 'pro'), not our internal variant ID (e.g. 'pro-monthly').
  const rows = await db
    .select({
      plan: subscriptionTable.plan,
      status: subscriptionTable.status,
      periodEnd: subscriptionTable.periodEnd,
      cancelAtPeriodEnd: subscriptionTable.cancelAtPeriodEnd,
    })
    .from(subscriptionTable)
    .where(eq(subscriptionTable.referenceId, userId));

  // Find the active/trialing subscription for the resolved plan.
  const active = rows.find(
    (r) =>
      (r.status === 'active' || r.status === 'trialing') &&
      normalizePlanId(r.plan ?? '') === planId,
  );
  if (!active || !active.status) return null;

  return {
    status: active.status,
    periodEnd: active.periodEnd ?? null,
    cancelAtPeriodEnd: active.cancelAtPeriodEnd ?? false,
  };
}
```

Note: `subscriptionTable` is already imported in `billing.server.ts` (line 11). Add `normalizePlanId` to the import from `@/billing/plans`.

**Step 2: Add `getUserBillingData` server function to `billing.functions.ts`**

```ts
import type { Plan, PlanId } from '@/billing/plans';
import {
  // ... existing imports from plans ...
  getFreePlan,
  getUpgradePlan,
} from '@/billing/plans';
import {
  // ... existing imports from billing.server ...
  getUserSubscriptionDetails,
} from '@/billing/billing.server';

/**
 * Returns the current user's billing state for the billing page.
 * Single server round-trip replaces the broken session.user.subscription approach.
 */
export const getUserBillingData = createServerFn().handler(async () => {
  const session = await requireVerifiedSession();
  const planId = await getUserActivePlanId(session.user.id);
  const plan = getPlanById(planId) ?? getFreePlan();
  const subscription = await getUserSubscriptionDetails(
    session.user.id,
    planId,
  );

  return { planId, plan, subscription };
});
```

**Step 3: Run typecheck**

Run: `bun run typecheck`
Expected: No errors

**Step 4: Commit**

```bash
git add src/billing/billing.server.ts src/billing/billing.functions.ts
git commit -m "feat(billing): add getUserBillingData server function for correct plan resolution"
```

---

### Task 3: Rewrite `BillingPage` to use `getUserBillingData`

Replace the broken `session.user.subscription` approach.

**Files:**

- Modify: `src/components/billing/billing-page.tsx`

**Step 1: Rewrite `BillingPage` component**

Replace the entire component. Key changes:

- Remove the `session.user as unknown` cast and subscription extraction (lines 99-117)
- Add `useQuery` for `getUserBillingData`
- Derive `currentPlan`, `upgradePlan`, `cancelAtPeriodEnd`, and `periodEnd` from the server response

```tsx
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  createCheckoutSession,
  createPortalSession,
  getInvoices,
  getUserBillingData,
  reactivateSubscription,
} from '@/billing/billing.functions';
import { getUpgradePlan } from '@/billing/plans';
import type { PlanId } from '@/billing/plans';
import { SESSION_QUERY_KEY } from '@/hooks/use-session-query';
import { Card, CardContent } from '@/components/ui/card';
import { BillingDowngradeBanner } from './billing-downgrade-banner';
import { BillingInvoiceTable } from './billing-invoice-table';
import { BillingPlanCards } from './billing-plan-cards';

const PAGE_LAYOUT_CLASS =
  'mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-4 md:py-6 lg:px-6';

const INVOICES_QUERY_KEY = ['billing', 'invoices'] as const;
const BILLING_DATA_QUERY_KEY = ['billing', 'data'] as const;

export function BillingPage() {
  const queryClient = useQueryClient();
  const [isAnnual, setIsAnnual] = useState(false);

  const billingQuery = useQuery({
    queryKey: BILLING_DATA_QUERY_KEY,
    queryFn: () => getUserBillingData(),
  });

  const invoicesQuery = useQuery({
    queryKey: INVOICES_QUERY_KEY,
    queryFn: () => getInvoices(),
  });

  const manageMutation = useMutation({
    mutationFn: () => createPortalSession(),
    onSuccess: (result) => {
      if (result.url) {
        window.location.href = result.url;
      }
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to open billing portal.');
    },
  });

  const upgradeMutation = useMutation({
    mutationFn: (planId: PlanId) => createCheckoutSession({ data: { planId } }),
    onSuccess: (result) => {
      if (result.url) {
        window.location.href = result.url;
      }
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to start checkout.');
    },
  });

  const reactivateMutation = useMutation({
    mutationFn: () => reactivateSubscription(),
    onSuccess: () => {
      toast.success('Subscription reactivated.');
      void queryClient.invalidateQueries({ queryKey: SESSION_QUERY_KEY });
      void queryClient.invalidateQueries({ queryKey: BILLING_DATA_QUERY_KEY });
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to reactivate subscription.');
    },
  });

  if (billingQuery.isPending || !billingQuery.data) return null;

  const { plan: currentPlan, subscription } = billingQuery.data;
  const upgradePlan = getUpgradePlan(currentPlan, isAnnual);

  const cancelAtPeriodEnd = subscription?.cancelAtPeriodEnd ?? false;
  const periodEnd = subscription?.periodEnd
    ? new Date(subscription.periodEnd)
    : null;

  return (
    <div className={PAGE_LAYOUT_CLASS}>
      {cancelAtPeriodEnd && periodEnd && (
        <BillingDowngradeBanner
          periodEnd={periodEnd}
          onReactivate={() => reactivateMutation.mutate()}
          isReactivating={reactivateMutation.isPending}
        />
      )}

      <BillingPlanCards
        currentPlan={currentPlan}
        upgradePlan={upgradePlan}
        nextBillingDate={periodEnd}
        isAnnual={isAnnual}
        onToggleInterval={setIsAnnual}
        onManage={() => manageMutation.mutate()}
        onUpgrade={(id) => upgradeMutation.mutate(id)}
        isManaging={manageMutation.isPending}
        isUpgrading={upgradeMutation.isPending}
      />

      <Card>
        <CardContent>
          <BillingInvoiceTable
            invoices={invoicesQuery.data ?? []}
            isLoading={invoicesQuery.isLoading}
          />
        </CardContent>
      </Card>
    </div>
  );
}
```

Key differences from current code:

- No `useSessionQuery` — uses `getUserBillingData` instead
- No `as unknown` cast — data is properly typed from server
- Imports `getUpgradePlan` from `plans.ts` (Task 1)
- Removed all unused imports (`FREE_PLAN_ID`, `PLANS`, `PLAN_GROUP`, `getFreePlan`, `getPlanById`, `normalizePlanId`, `useSessionQuery`)
- `upgradeMutation.mutationFn` takes `PlanId` (not the hardcoded union type)
- Invalidates `BILLING_DATA_QUERY_KEY` on reactivation too

**Step 2: Run typecheck**

Run: `bun run typecheck`
Expected: No errors

**Step 3: Manually verify in browser**

Navigate to `http://localhost:3000/billing` while logged in as a Pro subscriber.
Expected: Current plan shows "Pro" with correct price, not "Starter / Free forever".

**Step 4: Commit**

```bash
git add src/components/billing/billing-page.tsx
git commit -m "fix(billing): use getUserBillingData for correct plan display on billing page"
```

---

### Task 4: Add "Need more?" placeholder card to `BillingPlanCards`

When `upgradePlan` is `null` (highest tier), show a placeholder card instead of nothing.

**Files:**

- Modify: `src/components/billing/billing-plan-cards.tsx`

**Step 1: Add placeholder card rendering**

After the existing upgrade card block (`{upgradePlan && ( ... )}` at line 101-156), add an else branch:

Replace the upgrade card section (lines 100-156) with:

```tsx
{
  /* Upgrade Card */
}
{
  upgradePlan ? (
    <Card>
      <CardHeader>
        <CardDescription>Upgrade to</CardDescription>
        <CardTitle className="text-2xl">{upgradePlan.name}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          {upgradePlan.price > 0 && (
            <p className="text-sm font-medium">{formatPrice(upgradePlan)}</p>
          )}
          <div className="flex items-center gap-0.5 rounded-full border p-0.5">
            <Toggle
              pressed={!isAnnual}
              onPressedChange={() => onToggleInterval(false)}
              size="sm"
              className="aria-pressed:bg-foreground aria-pressed:text-background h-6 rounded-full px-2.5 text-xs"
              aria-label="Monthly billing"
            >
              Monthly
            </Toggle>
            <Toggle
              pressed={isAnnual}
              onPressedChange={() => onToggleInterval(true)}
              size="sm"
              className="aria-pressed:bg-foreground aria-pressed:text-background h-6 rounded-full px-2.5 text-xs"
              aria-label="Annual billing"
            >
              Annual
            </Toggle>
          </div>
        </div>
        <ul className="mt-1 flex flex-col gap-2">
          {upgradePlan.features.map((feature) => (
            <li key={feature} className="flex items-center gap-2 text-sm">
              <IconCheck className="text-primary size-3.5 shrink-0" />
              {feature}
            </li>
          ))}
        </ul>
      </CardContent>
      <CardFooter>
        <Button
          className="w-full"
          onClick={() => onUpgrade(upgradePlan.id)}
          disabled={isUpgrading}
        >
          {isUpgrading ? 'Redirecting...' : `Upgrade to ${upgradePlan.name}`}
        </Button>
      </CardFooter>
    </Card>
  ) : (
    <Card>
      <CardHeader>
        <CardDescription>Need more?</CardDescription>
        <CardTitle className="text-2xl">Custom plan</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-muted-foreground text-sm">
          You're on our best plan. Contact us for a custom plan tailored to your
          needs.
        </p>
      </CardContent>
    </Card>
  );
}
```

**Step 2: Run typecheck**

Run: `bun run typecheck`
Expected: No errors

**Step 3: Manually verify in browser**

Navigate to `http://localhost:3000/billing` as a Pro subscriber.
Expected: Two cards — "Pro" current plan on left, "Need more? / Custom plan" on right.

**Step 4: Commit**

```bash
git add src/components/billing/billing-plan-cards.tsx
git commit -m "feat(billing): show 'Need more?' placeholder card for highest-tier users"
```

---

### Task 5: Extend `checkPlanLimit` to return upgrade plan info

The upgrade prompt needs to know which plan to offer (or that there's no upgrade available).

**Files:**

- Modify: `src/billing/billing.functions.ts` — extend `checkPlanLimit` return value

**Step 1: Extend `checkPlanLimit` return type**

Add `upgradePlan: Plan | null` to every return path. Import `getUpgradePlan` from `plans.ts`.

In `src/billing/billing.functions.ts`, update the `checkPlanLimit` handler:

```ts
import {
  // ... existing imports from plans ...
  getUpgradePlan,
} from '@/billing/plans';
import type { Plan } from '@/billing/plans';
```

Then update the handler. Each `return` statement needs `upgradePlan` added. The upgrade plan is computed from the relevant user's plan (current user for workspace limits, workspace owner for member limits):

```ts
export const checkPlanLimit = createServerFn()
  .inputValidator(checkPlanLimitInput)
  .handler(async ({ data }) => {
    const session = await requireVerifiedSession();
    const userId = session.user.id;
    const planId = await getUserActivePlanId(userId);
    const limits = getPlanLimitsForPlanId(planId);
    const plan = getPlanById(planId);
    const planName = plan?.name ?? 'Free';
    // Default to monthly variant for upgrade suggestion.
    const upgradePlan = plan ? getUpgradePlan(plan, false) : null;

    if (data.feature === 'workspace') {
      const limit = limits.maxWorkspaces;
      if (limit === -1) {
        return { allowed: true, current: 0, limit: -1, planName, upgradePlan };
      }
      const current = await countOwnedWorkspaces(userId);
      return {
        allowed: current < limit,
        current,
        limit,
        planName,
        upgradePlan,
      };
    }

    if (!data.workspaceId) {
      throw new Error('workspaceId is required for member limit check.');
    }

    const ownerId = await getWorkspaceOwnerUserId(data.workspaceId);
    if (!ownerId) {
      return { allowed: true, current: 0, limit: -1, planName, upgradePlan };
    }
    const ownerPlanId = await getUserActivePlanId(ownerId);
    const ownerLimits = getPlanLimitsForPlanId(ownerPlanId);
    const ownerPlan = getPlanById(ownerPlanId);
    const ownerPlanName = ownerPlan?.name ?? 'Free';
    const ownerUpgradePlan = ownerPlan
      ? getUpgradePlan(ownerPlan, false)
      : null;

    const limit = ownerLimits.maxMembersPerWorkspace;
    if (limit === -1) {
      return {
        allowed: true,
        current: 0,
        limit: -1,
        planName: ownerPlanName,
        upgradePlan: ownerUpgradePlan,
      };
    }
    const current = await countWorkspaceMembers(data.workspaceId);
    return {
      allowed: current < limit,
      current,
      limit,
      planName: ownerPlanName,
      upgradePlan: ownerUpgradePlan,
    };
  });
```

**Step 2: Run typecheck**

Run: `bun run typecheck`
Expected: No errors (callers receive extra field but don't need to destructure it yet)

**Step 3: Commit**

```bash
git add src/billing/billing.functions.ts
git commit -m "feat(billing): extend checkPlanLimit to return upgradePlan for tier-aware prompts"
```

---

### Task 6: Make `useUpgradePrompt` and `UpgradePromptDialog` tier-aware

Remove hardcoded Pro references. Support two modes: upgrade offer vs. limit-reached message.

**Files:**

- Modify: `src/hooks/use-upgrade-prompt.ts`
- Modify: `src/components/billing/upgrade-prompt-dialog.tsx`

**Step 1: Rewrite `useUpgradePrompt` hook**

The hook needs to accept upgrade plan info and handle two modes.

```ts
import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { createCheckoutSession } from '@/billing/billing.functions';
import type { Plan, PlanId } from '@/billing/plans';
import { PLAN_GROUP, PLANS } from '@/billing/plans';

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
    mutationFn: (planId: PlanId) => createCheckoutSession({ data: { planId } }),
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

  /** Resolves the correct plan variant (monthly/annual) for checkout. */
  const getUpgradePlanVariant = (): Plan | null => {
    const { upgradePlan } = prompt;
    if (!upgradePlan) return null;
    if (!isAnnual) return upgradePlan;
    // Find the annual variant of the same plan group.
    const group = PLAN_GROUP[upgradePlan.id];
    return (
      PLANS.find((p) => PLAN_GROUP[p.id] === group && p.interval === 'year') ??
      upgradePlan
    );
  };

  const resolvedPlan = getUpgradePlanVariant();

  const dialogProps = {
    open: prompt.open,
    onOpenChange: (open: boolean) => setPrompt((prev) => ({ ...prev, open })),
    title: prompt.title,
    description: prompt.description,
    upgradePlan: resolvedPlan,
    isUpgrading: upgradeMutation.isPending,
    onUpgrade: () => {
      if (resolvedPlan) {
        upgradeMutation.mutate(resolvedPlan.id);
      }
    },
    isAnnual,
    onToggleInterval: setIsAnnual,
  };

  return { show, dialogProps };
}
```

Key changes:

- `show()` now takes a third parameter: `upgradePlan: Plan | null`
- Mutation takes a `PlanId` instead of hardcoded boolean logic
- `getUpgradePlanVariant()` resolves monthly/annual variant dynamically
- `dialogProps.upgradePlan` passes the resolved plan (or null) to the dialog

**Step 2: Rewrite `UpgradePromptDialog`**

Remove hardcoded `proMonthly`/`proAnnual`. Accept `upgradePlan: Plan | null` as prop. Show limit-reached message when null.

```tsx
import { IconCheck, IconLoader2, IconSparkles } from '@tabler/icons-react';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Toggle } from '@/components/ui/toggle';
import type { Plan } from '@/billing/plans';

const CURRENCY_FORMAT = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 0,
});

function formatPrice(plan: Plan): string {
  if (plan.price === 0) return '';
  const monthly =
    plan.interval === 'year' ? plan.price / 12 / 100 : plan.price / 100;
  return `${CURRENCY_FORMAT.format(monthly)}/mo`;
}

interface UpgradePromptDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  /** The plan to offer. null = show limit-reached message. */
  upgradePlan: Plan | null;
  isUpgrading: boolean;
  onUpgrade: () => void;
  isAnnual: boolean;
  onToggleInterval: (annual: boolean) => void;
}

export function UpgradePromptDialog({
  open,
  onOpenChange,
  title,
  description,
  upgradePlan,
  isUpgrading,
  onUpgrade,
  isAnnual,
  onToggleInterval,
}: UpgradePromptDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent size="sm" className="gap-0 p-0">
        {/* Accessible title — visually hidden, used by screen readers. */}
        <AlertDialogTitle className="sr-only">{title}</AlertDialogTitle>

        {/* Context banner — explains why the dialog appeared. */}
        <div className="bg-muted/50 flex items-center gap-3 rounded-t-xl px-7 py-4">
          <IconSparkles className="text-muted-foreground size-4 shrink-0" />
          <AlertDialogDescription className="text-muted-foreground text-xs">
            {description}
          </AlertDialogDescription>
        </div>

        <div className="flex flex-col gap-6 p-7">
          {upgradePlan ? (
            <>
              {/* Plan name + price + toggle */}
              <div className="flex flex-col gap-4">
                <div className="flex items-baseline gap-2">
                  <h3 className="text-xl font-semibold tracking-tight">
                    {upgradePlan.name}
                  </h3>
                  {formatPrice(upgradePlan) && (
                    <span className="text-muted-foreground text-sm">
                      {formatPrice(upgradePlan)}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-0.5 self-start rounded-full border p-0.5">
                  <Toggle
                    pressed={!isAnnual}
                    onPressedChange={() => onToggleInterval(false)}
                    size="sm"
                    className="aria-pressed:bg-foreground aria-pressed:text-background h-6 rounded-full px-2.5 text-xs"
                    aria-label="Monthly billing"
                  >
                    Monthly
                  </Toggle>
                  <Toggle
                    pressed={isAnnual}
                    onPressedChange={() => onToggleInterval(true)}
                    size="sm"
                    className="aria-pressed:bg-foreground aria-pressed:text-background h-6 rounded-full px-2.5 text-xs"
                    aria-label="Annual billing"
                  >
                    Annual
                  </Toggle>
                </div>
              </div>

              {/* Features */}
              <ul className="flex flex-col gap-2.5">
                {upgradePlan.features.map((feature) => (
                  <li
                    key={feature}
                    className="flex items-center gap-2.5 text-sm"
                  >
                    <IconCheck className="text-primary size-3.5 shrink-0" />
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
                  className="text-muted-foreground h-auto border-0 px-0 py-1 text-xs shadow-none"
                >
                  Maybe later
                </AlertDialogCancel>
              </div>
            </>
          ) : (
            /* Limit-reached message — no upgrade available. */
            <div className="flex flex-col items-center gap-3 pt-1">
              <p className="text-muted-foreground text-center text-sm">
                You've reached the limits of your current plan. Contact us for a
                custom plan tailored to your needs.
              </p>
              <AlertDialogCancel variant="outline" size="sm" className="mt-2">
                Got it
              </AlertDialogCancel>
            </div>
          )}
        </div>
      </AlertDialogContent>
    </AlertDialog>
  );
}
```

**Step 3: Run typecheck**

Run: `bun run typecheck`
Expected: Type errors in `members.tsx` and `workspace-switcher.tsx` — `show()` now requires 3 args. Fixed in Task 7.

**Step 4: Commit**

```bash
git add src/hooks/use-upgrade-prompt.ts src/components/billing/upgrade-prompt-dialog.tsx
git commit -m "feat(billing): make upgrade prompt tier-aware with dynamic plan and limit-reached mode"
```

---

### Task 7: Update callers to pass `upgradePlan` to `show()`

Fix the call sites in `members.tsx` and `workspace-switcher.tsx`.

**Files:**

- Modify: `src/routes/_protected/ws/$workspaceId/members.tsx`
- Modify: `src/components/workspace-switcher.tsx`

**Step 1: Update `members.tsx`**

In the `handleInviteClick` function, pass `result.upgradePlan` as the third argument to `show()`:

```ts
upgradePrompt.show(
  'Member limit reached',
  `This workspace has ${result.current}/${result.limit} members on the ${result.planName} plan. Upgrade to invite more.`,
  result.upgradePlan,
);
```

**Step 2: Update `workspace-switcher.tsx`**

In the `handleAddWorkspace` function, pass `result.upgradePlan` as the third argument to `show()`:

```ts
upgradePrompt.show(
  'Workspace limit reached',
  `You're using ${result.current}/${result.limit} workspaces on the ${result.planName} plan. Upgrade to create more.`,
  result.upgradePlan,
);
```

**Step 3: Run typecheck**

Run: `bun run typecheck`
Expected: No errors

**Step 4: Run full test suite**

Run: `bun test`
Expected: All tests pass

**Step 5: Commit**

```bash
git add src/routes/_protected/ws/$workspaceId/members.tsx src/components/workspace-switcher.tsx
git commit -m "fix(billing): pass upgradePlan to upgrade prompt callers for tier-aware display"
```

---

### Task 8: Make `upgradeInput` zod schema dynamic

Remove the hardcoded plan ID enum so new plans are automatically accepted.

**Files:**

- Modify: `src/billing/billing.functions.ts`

**Step 1: Update the zod schema**

Replace:

```ts
const upgradeInput = z.object({
  planId: z.enum(['starter', 'pro-monthly', 'pro-annual']),
});
```

With:

```ts
import { PLANS } from '@/billing/plans';
import type { PlanId } from '@/billing/plans';

const VALID_PLAN_IDS = PLANS.map((p) => p.id) as [PlanId, ...PlanId[]];

const upgradeInput = z.object({
  planId: z.enum(VALID_PLAN_IDS),
});
```

The `as [PlanId, ...PlanId[]]` cast satisfies Zod's requirement that `z.enum` receives a non-empty tuple.

**Step 2: Run typecheck**

Run: `bun run typecheck`
Expected: No errors

**Step 3: Run tests**

Run: `bun test`
Expected: All pass

**Step 4: Commit**

```bash
git add src/billing/billing.functions.ts
git commit -m "refactor(billing): derive upgradeInput schema from PLANS array for future-proof validation"
```

---

### Task 9: Final verification

**Step 1: Run full checks**

Run: `bun run check`
Expected: No type errors, no lint errors

**Step 2: Run test suite**

Run: `bun test`
Expected: All tests pass

**Step 3: Manual browser verification**

Test these scenarios at `http://localhost:3000`:

1. **Pro subscriber on billing page:** Current plan shows "Pro" with correct price and renewal date. Right card shows "Need more? / Custom plan".
2. **Starter user on billing page:** Current plan shows "Starter / Free forever". Right card shows "Pro" upgrade with price and features.
3. **Pro subscriber hits workspace limit:** Upgrade prompt shows limit-reached message ("Got it" button), not "Upgrade to Pro".
4. **Starter user hits workspace limit:** Upgrade prompt shows Pro plan offer with monthly/annual toggle and checkout button.
5. **Pro subscriber hits member limit:** Same as workspace limit — limit-reached message.

**Step 4: Commit any fixes from verification**

If any issues found, fix and commit individually.
