# Billing Server Refactor Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Extract all business logic from `billing.functions.ts` handlers into testable functions in `billing.server.ts`, making `billing.functions.ts` a thin wrapper layer.

**Architecture:** Move handler logic to `billing.server.ts` as plain async functions that accept `headers`/`userId` as parameters instead of calling `getRequestHeaders()` internally. Introduce `getUserPlanContext()` to consolidate the repeated plan resolution pattern. Add unit tests for all extracted functions.

**Tech Stack:** TypeScript, Vitest, TanStack Start (server functions), Better Auth, Stripe SDK, Drizzle ORM

**Design doc:** `docs/plans/2026-03-12-billing-server-refactor-design.md`

---

### Task 1: Add `headers` parameter to `getUserActivePlanId` and update callers

This is the foundation — other extracted functions depend on this signature change.

**Files:**

- Modify: `src/billing/billing.server.ts`
- Modify: `src/billing/billing.functions.ts`

**Step 1: Update `getUserActivePlanId` signature**

In `src/billing/billing.server.ts`, replace the `getUserActivePlanId` function (lines 26-33):

```ts
/**
 * Returns the active plan ID for a user using Better Auth's subscription API.
 * Delegates to resolveUserPlanId() (pure function in plans.ts) for plan resolution.
 */
export async function getUserActivePlanId(
  headers: Headers,
  userId: string,
): Promise<PlanId> {
  const subscriptions = await auth.api.listActiveSubscriptions({
    headers,
    query: { referenceId: userId },
  });
  return resolveUserPlanId(Array.from(subscriptions));
}
```

Remove the `import { getRequestHeaders } from '@tanstack/react-start/server';` import from `billing.server.ts` (line 1) — it's no longer used here.

**Step 2: Update `getUserPlanLimits` to pass headers**

In `src/billing/billing.server.ts`, replace `getUserPlanLimits` (lines 38-41):

```ts
/**
 * Returns the plan limits for a given user based on their subscription.
 */
export async function getUserPlanLimits(
  headers: Headers,
  userId: string,
): Promise<PlanLimits> {
  const planId = await getUserActivePlanId(headers, userId);
  return getPlanLimitsForPlanId(planId);
}
```

**Step 3: Update callers in `billing.functions.ts`**

In `src/billing/billing.functions.ts`, every call to `getUserActivePlanId(userId)` becomes `getUserActivePlanId(headers, userId)`. There are 3 call sites:

Line 117 (getUserBillingData):

```ts
// Before:
const planId = await getUserActivePlanId(session.user.id);
// After:
const headers = getRequestHeaders();
const planId = await getUserActivePlanId(headers, session.user.id);
```

Line 179 (checkPlanLimit — current user):

```ts
// Before:
const planId = await getUserActivePlanId(userId);
// After:
const headers = getRequestHeaders();
const planId = await getUserActivePlanId(headers, userId);
```

Line 210 (checkPlanLimit — workspace owner):

```ts
// Before:
const ownerPlanId = await getUserActivePlanId(ownerId);
// After:
const ownerPlanId = await getUserActivePlanId(headers, ownerId);
```

Note: `checkPlanLimit` handler only needs one `const headers = getRequestHeaders();` at the top of the handler, shared by both call sites.

**Step 4: Run typecheck**

Run: `bun run typecheck`
Expected: No errors

**Step 5: Run tests**

Run: `bun test`
Expected: All existing tests pass (no billing.server tests yet)

**Step 6: Commit**

```bash
git add src/billing/billing.server.ts src/billing/billing.functions.ts
git commit -m "refactor(billing): add headers parameter to getUserActivePlanId"
```

---

### Task 2: Add `getUserPlanContext` helper and extract `getBillingData`

Introduce the shared plan resolution helper and extract the first function.

**Files:**

- Modify: `src/billing/billing.server.ts`
- Modify: `src/billing/billing.functions.ts`

**Step 1: Add `UserPlanContext` interface and `getUserPlanContext` to `billing.server.ts`**

Add these after the `getUserPlanLimits` function, along with the new imports needed from `plans.ts`:

Update the imports at the top of `billing.server.ts`:

```ts
import {
  getFreePlan,
  getPlanById,
  getPlanLimitsForPlanId,
  getUpgradePlan,
  resolveUserPlanId,
} from '@/billing/plans';
import type { Plan, PlanId, PlanLimits } from '@/billing/plans';
```

Add the interface and function:

```ts
export interface UserPlanContext {
  planId: PlanId;
  plan: Plan;
  planName: string;
  limits: PlanLimits;
  upgradePlan: Plan | null;
}

/**
 * Resolves a user's full plan context — plan, limits, and upgrade path.
 * Consolidates the repeated plan resolution pattern used by billing data
 * and plan limit checks.
 */
export async function getUserPlanContext(
  headers: Headers,
  userId: string,
): Promise<UserPlanContext> {
  const planId = await getUserActivePlanId(headers, userId);
  const plan = getPlanById(planId) ?? getFreePlan();
  const limits = getPlanLimitsForPlanId(planId);
  const upgradePlan = getUpgradePlan(plan);

  return {
    planId,
    plan,
    planName: plan.name,
    limits,
    upgradePlan,
  };
}
```

**Step 2: Add `getBillingData` to `billing.server.ts`**

Add after `getUserPlanContext`:

```ts
/**
 * Returns the current user's billing state for the billing page.
 * Single server round-trip replaces the broken session.user.subscription approach.
 */
export async function getBillingData(headers: Headers, userId: string) {
  const { planId, plan } = await getUserPlanContext(headers, userId);
  const subscription = await getUserSubscriptionDetails(userId, planId);
  return { planId, plan, subscription };
}
```

**Step 3: Simplify `getUserBillingData` wrapper in `billing.functions.ts`**

Replace the `getUserBillingData` handler (lines 115-125):

```ts
/**
 * Returns the current user's billing state for the billing page.
 */
export const getUserBillingData = createServerFn().handler(async () => {
  const session = await requireVerifiedSession();
  const headers = getRequestHeaders();
  return getBillingData(headers, session.user.id);
});
```

Update the imports in `billing.functions.ts` — add `getBillingData` to the `billing.server` imports, remove `getUserSubscriptionDetails` (no longer needed here). Also remove `getFreePlan`, `getPlanById` from `plans` imports since they're no longer used here.

**Step 4: Run typecheck**

Run: `bun run typecheck`
Expected: No errors

**Step 5: Commit**

```bash
git add src/billing/billing.server.ts src/billing/billing.functions.ts
git commit -m "refactor(billing): add getUserPlanContext and extract getBillingData"
```

---

### Task 3: Extract `checkUserPlanLimit` to `billing.server.ts`

The most complex function — uses `getUserPlanContext` to eliminate repeated plan resolution.

**Files:**

- Modify: `src/billing/billing.server.ts`
- Modify: `src/billing/billing.functions.ts`

**Step 1: Add `CheckPlanLimitResult` interface and `checkUserPlanLimit` to `billing.server.ts`**

Add after `getBillingData`:

```ts
export interface CheckPlanLimitResult {
  allowed: boolean;
  current: number;
  limit: number;
  planName: string;
  upgradePlan: Plan | null;
}

/**
 * Checks whether a user can perform a plan-limited action.
 * Returns usage info for the UI to display in the upgrade prompt.
 *
 * For workspace limits, checks the current user's plan.
 * For member limits, checks the workspace owner's plan (mirrors
 * the beforeCreateInvitation hook in auth.server.ts).
 */
export async function checkUserPlanLimit(
  headers: Headers,
  userId: string,
  feature: 'workspace' | 'member',
  workspaceId?: string,
): Promise<CheckPlanLimitResult> {
  if (feature === 'workspace') {
    const ctx = await getUserPlanContext(headers, userId);
    const limit = ctx.limits.maxWorkspaces;
    if (limit === -1) {
      return {
        allowed: true,
        current: 0,
        limit: -1,
        planName: ctx.planName,
        upgradePlan: ctx.upgradePlan,
      };
    }
    const current = await countOwnedWorkspaces(userId);
    return {
      allowed: current < limit,
      current,
      limit,
      planName: ctx.planName,
      upgradePlan: ctx.upgradePlan,
    };
  }

  if (!workspaceId) {
    throw new Error('workspaceId is required for member limit check.');
  }

  // Member limits are based on the workspace owner's plan, not the
  // current user's plan. This mirrors the beforeCreateInvitation hook.
  const ownerId = await getWorkspaceOwnerUserId(workspaceId);
  if (!ownerId) {
    const ctx = await getUserPlanContext(headers, userId);
    return {
      allowed: true,
      current: 0,
      limit: -1,
      planName: ctx.planName,
      upgradePlan: ctx.upgradePlan,
    };
  }

  const ctx = await getUserPlanContext(headers, ownerId);
  const limit = ctx.limits.maxMembersPerWorkspace;
  if (limit === -1) {
    return {
      allowed: true,
      current: 0,
      limit: -1,
      planName: ctx.planName,
      upgradePlan: ctx.upgradePlan,
    };
  }
  const current = await countWorkspaceMembers(workspaceId);
  return {
    allowed: current < limit,
    current,
    limit,
    planName: ctx.planName,
    upgradePlan: ctx.upgradePlan,
  };
}
```

**Step 2: Simplify `checkPlanLimit` wrapper in `billing.functions.ts`**

Replace the `checkPlanLimit` handler (lines 174-234):

```ts
/**
 * Checks whether the current user can perform a plan-limited action.
 * Returns usage info for the UI to display in the upgrade prompt.
 */
export const checkPlanLimit = createServerFn()
  .inputValidator(checkPlanLimitInput)
  .handler(async ({ data }) => {
    const session = await requireVerifiedSession();
    const headers = getRequestHeaders();
    return checkUserPlanLimit(
      headers,
      session.user.id,
      data.feature,
      data.workspaceId,
    );
  });
```

Update the imports in `billing.functions.ts` — add `checkUserPlanLimit` to the `billing.server` imports, remove `countOwnedWorkspaces`, `countWorkspaceMembers`, `getWorkspaceOwnerUserId`, `getUserActivePlanId` (no longer used here). Remove `getPlanLimitsForPlanId`, `getUpgradePlan` from `plans` imports.

**Step 3: Run typecheck**

Run: `bun run typecheck`
Expected: No errors

**Step 4: Commit**

```bash
git add src/billing/billing.server.ts src/billing/billing.functions.ts
git commit -m "refactor(billing): extract checkUserPlanLimit to billing.server.ts"
```

---

### Task 4: Extract remaining 3 functions and move `stripeClient`

Extract `getInvoicesForUser`, `createCheckoutForPlan`, `createBillingPortal`, and `reactivateUserSubscription`. Move the Stripe SDK client.

**Files:**

- Modify: `src/billing/billing.server.ts`
- Modify: `src/billing/billing.functions.ts`

**Step 1: Move `stripeClient` to `billing.server.ts`**

Add to `billing.server.ts` imports:

```ts
import Stripe from 'stripe';
```

Add after the existing imports section:

```ts
const stripeClient = new Stripe(process.env.STRIPE_SECRET_KEY!);
```

**Step 2: Add `getInvoicesForUser` to `billing.server.ts`**

```ts
/**
 * Fetches a user's invoices from Stripe (past 12 months).
 */
export async function getInvoicesForUser(userId: string) {
  const [dbUser] = await db
    .select({ stripeCustomerId: userTable.stripeCustomerId })
    .from(userTable)
    .where(eq(userTable.id, userId));

  if (!dbUser.stripeCustomerId) return [];

  const SECONDS_PER_YEAR = 365 * 24 * 60 * 60;
  const twelveMonthsAgo = Math.floor(Date.now() / 1000) - SECONDS_PER_YEAR;
  const invoices = await stripeClient.invoices.list({
    customer: dbUser.stripeCustomerId,
    limit: 100,
    created: { gte: twelveMonthsAgo },
  });

  return invoices.data.map((inv) => ({
    id: inv.id,
    date: inv.created,
    status: inv.status,
    amount: inv.amount_paid,
    currency: inv.currency,
    invoiceUrl: inv.hosted_invoice_url,
    invoicePdf: inv.invoice_pdf,
  }));
}
```

Add the needed imports to `billing.server.ts`:

```ts
import { user as userTable } from '@/db/schema';
```

Update the existing schema import to include `userTable`:

```ts
import {
  member as memberTable,
  subscription as subscriptionTable,
  user as userTable,
} from '@/db/schema';
```

**Step 3: Add `createCheckoutForPlan` to `billing.server.ts`**

```ts
/**
 * Creates a Stripe Checkout session to subscribe to a plan.
 * PlanId maps 1:1 to Better Auth's plan name — no translation needed.
 */
export async function createCheckoutForPlan(
  headers: Headers,
  planId: PlanId,
  annual: boolean,
) {
  const result = await auth.api.upgradeSubscription({
    headers,
    body: {
      plan: planId,
      annual,
      successUrl: `${process.env.BETTER_AUTH_URL}/billing?success=true`,
      cancelUrl: `${process.env.BETTER_AUTH_URL}/billing`,
    },
  });

  return { url: result.url, redirect: result.redirect };
}
```

**Step 4: Add `createUserBillingPortal` to `billing.server.ts`**

```ts
/**
 * Creates a Stripe Customer Portal session for managing the subscription.
 */
export async function createUserBillingPortal(headers: Headers) {
  const result = await auth.api.createBillingPortal({
    headers,
    body: {
      returnUrl: `${process.env.BETTER_AUTH_URL}/billing`,
    },
  });
  return { url: result.url, redirect: result.redirect };
}
```

**Step 5: Add `reactivateUserSubscription` to `billing.server.ts`**

```ts
/**
 * Reactivates a subscription that was set to cancel at period end.
 * Picks the highest-tier active subscription and restores it.
 */
export async function reactivateUserSubscription(
  headers: Headers,
  userId: string,
) {
  const subscriptions = await auth.api.listActiveSubscriptions({
    headers,
    query: { referenceId: userId },
  });

  const active = subscriptions.filter(
    (s) => s.status === 'active' || s.status === 'trialing',
  );

  if (active.length === 0) {
    throw new Error('No active subscription found.');
  }

  const bestPlanId = resolveUserPlanId(active);
  const target = active.find((s) => s.plan === bestPlanId);
  if (!target?.id) {
    throw new Error('Could not find subscription to restore.');
  }

  await auth.api.restoreSubscription({
    headers,
    body: { subscriptionId: target.id },
  });

  return { success: true };
}
```

**Step 6: Rewrite `billing.functions.ts` as thin wrappers**

Replace the entire file:

```ts
import { createServerFn } from '@tanstack/react-start';
import { getRequestHeaders } from '@tanstack/react-start/server';
import * as z from 'zod';
import {
  checkUserPlanLimit,
  createCheckoutForPlan,
  createUserBillingPortal,
  getBillingData,
  getInvoicesForUser,
  reactivateUserSubscription,
  requireVerifiedSession,
} from '@/billing/billing.server';
import type { PlanId } from '@/billing/plans';
import { PLANS } from '@/billing/plans';

/**
 * Fetches the current user's invoices from Stripe (past 12 months).
 */
export const getInvoices = createServerFn().handler(async () => {
  const session = await requireVerifiedSession();
  return getInvoicesForUser(session.user.id);
});

const VALID_PLAN_IDS = PLANS.map((p) => p.id) as [PlanId, ...Array<PlanId>];

const upgradeInput = z.object({
  planId: z.enum(VALID_PLAN_IDS),
  annual: z.boolean(),
});

/**
 * Creates a Stripe Checkout session to subscribe to a plan.
 */
export const createCheckoutSession = createServerFn()
  .inputValidator(upgradeInput)
  .handler(async ({ data }) => {
    const headers = getRequestHeaders();
    await requireVerifiedSession();
    return createCheckoutForPlan(headers, data.planId, data.annual);
  });

/**
 * Creates a Stripe Customer Portal session for managing the subscription.
 */
export const createPortalSession = createServerFn().handler(async () => {
  const headers = getRequestHeaders();
  await requireVerifiedSession();
  return createUserBillingPortal(headers);
});

/**
 * Returns the current user's billing state for the billing page.
 */
export const getUserBillingData = createServerFn().handler(async () => {
  const session = await requireVerifiedSession();
  const headers = getRequestHeaders();
  return getBillingData(headers, session.user.id);
});

/**
 * Reactivates a subscription that was set to cancel at period end.
 */
export const reactivateSubscription = createServerFn().handler(async () => {
  const headers = getRequestHeaders();
  const session = await requireVerifiedSession();
  return reactivateUserSubscription(headers, session.user.id);
});

const checkPlanLimitInput = z.object({
  feature: z.enum(['workspace', 'member']),
  workspaceId: z.string().optional(),
});

/**
 * Checks whether the current user can perform a plan-limited action.
 */
export const checkPlanLimit = createServerFn()
  .inputValidator(checkPlanLimitInput)
  .handler(async ({ data }) => {
    const session = await requireVerifiedSession();
    const headers = getRequestHeaders();
    return checkUserPlanLimit(
      headers,
      session.user.id,
      data.feature,
      data.workspaceId,
    );
  });
```

**Step 7: Run typecheck**

Run: `bun run typecheck`
Expected: No errors

**Step 8: Run tests**

Run: `bun test`
Expected: All existing tests pass

**Step 9: Commit**

```bash
git add src/billing/billing.server.ts src/billing/billing.functions.ts
git commit -m "refactor(billing): extract all handler logic to billing.server.ts — thin wrappers only"
```

---

### Task 5: Write tests for `getUserPlanContext` and `getBillingData`

**Files:**

- Create: `src/billing/billing.server.test.ts`

**Step 1: Write the test file**

Create `src/billing/billing.server.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PlanId } from '@/billing/plans';

// ── Mocks ──────────────────────────────────────────────────────────────────

const {
  listActiveSubscriptionsMock,
  createBillingPortalMock,
  upgradeSubscriptionMock,
  restoreSubscriptionMock,
} = vi.hoisted(() => ({
  listActiveSubscriptionsMock: vi.fn(),
  createBillingPortalMock: vi.fn(),
  upgradeSubscriptionMock: vi.fn(),
  restoreSubscriptionMock: vi.fn(),
}));

vi.mock('@/auth/auth.server', () => ({
  auth: {
    api: {
      listActiveSubscriptions: listActiveSubscriptionsMock,
      createBillingPortal: createBillingPortalMock,
      upgradeSubscription: upgradeSubscriptionMock,
      restoreSubscription: restoreSubscriptionMock,
    },
  },
}));

const { dbSelectMock } = vi.hoisted(() => ({
  dbSelectMock: vi.fn(),
}));

// Chainable query builder mock.
const fromMock = vi.fn();
const whereMock = vi.fn();
dbSelectMock.mockReturnValue({ from: fromMock });
fromMock.mockReturnValue({ where: whereMock });

vi.mock('@/db', () => ({
  db: { select: dbSelectMock },
}));

vi.mock('@/db/schema', () => ({
  member: 'member',
  subscription: 'subscription',
  user: 'user',
}));

vi.mock('drizzle-orm', () => ({
  and: vi.fn((...args: unknown[]) => args),
  count: vi.fn(() => 'count'),
  eq: vi.fn((a: unknown, b: unknown) => [a, b]),
}));

vi.mock('stripe', () => ({
  default: vi.fn().mockImplementation(() => ({
    invoices: { list: vi.fn().mockResolvedValue({ data: [] }) },
  })),
}));

// ── Import after mocks ────────────────────────────────────────────────────

import { getBillingData, getUserPlanContext } from '@/billing/billing.server';

// ── Helpers ────────────────────────────────────────────────────────────────

const MOCK_HEADERS = new Headers();
const MOCK_USER_ID = 'user-123';

function mockSubscriptions(subs: Array<{ plan: string; status: string }>) {
  listActiveSubscriptionsMock.mockResolvedValueOnce(subs);
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe('getUserPlanContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset chainable mock.
    dbSelectMock.mockReturnValue({ from: fromMock });
    fromMock.mockReturnValue({ where: whereMock });
  });

  it('returns starter context when no subscriptions exist', async () => {
    mockSubscriptions([]);
    const ctx = await getUserPlanContext(MOCK_HEADERS, MOCK_USER_ID);

    expect(ctx.planId).toBe('starter');
    expect(ctx.planName).toBe('Starter');
    expect(ctx.limits.maxWorkspaces).toBe(1);
    expect(ctx.upgradePlan).toBeDefined();
    expect(ctx.upgradePlan!.id).toBe('pro');
  });

  it('returns pro context for active pro subscription', async () => {
    mockSubscriptions([{ plan: 'pro', status: 'active' }]);
    const ctx = await getUserPlanContext(MOCK_HEADERS, MOCK_USER_ID);

    expect(ctx.planId).toBe('pro');
    expect(ctx.planName).toBe('Pro');
    expect(ctx.limits.maxWorkspaces).toBe(5);
    expect(ctx.upgradePlan).toBeNull();
  });

  it('returns pro context for trialing subscription', async () => {
    mockSubscriptions([{ plan: 'pro', status: 'trialing' }]);
    const ctx = await getUserPlanContext(MOCK_HEADERS, MOCK_USER_ID);

    expect(ctx.planId).toBe('pro');
  });

  it('falls back to starter for unknown plan', async () => {
    mockSubscriptions([{ plan: 'unknown', status: 'active' }]);
    const ctx = await getUserPlanContext(MOCK_HEADERS, MOCK_USER_ID);

    expect(ctx.planId).toBe('starter');
  });

  it('passes headers to listActiveSubscriptions', async () => {
    mockSubscriptions([]);
    await getUserPlanContext(MOCK_HEADERS, MOCK_USER_ID);

    expect(listActiveSubscriptionsMock).toHaveBeenCalledWith({
      headers: MOCK_HEADERS,
      query: { referenceId: MOCK_USER_ID },
    });
  });
});

describe('getBillingData', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbSelectMock.mockReturnValue({ from: fromMock });
    fromMock.mockReturnValue({ where: whereMock });
  });

  it('returns plan and null subscription for free user', async () => {
    mockSubscriptions([]);
    // getUserSubscriptionDetails DB query returns no matching rows.
    whereMock.mockResolvedValueOnce([]);

    const data = await getBillingData(MOCK_HEADERS, MOCK_USER_ID);

    expect(data.planId).toBe('starter');
    expect(data.plan.id).toBe('starter');
    expect(data.subscription).toBeNull();
  });

  it('returns plan and subscription for pro user', async () => {
    mockSubscriptions([{ plan: 'pro', status: 'active' }]);
    // getUserSubscriptionDetails DB query returns matching row.
    whereMock.mockResolvedValueOnce([
      {
        plan: 'pro',
        status: 'active',
        periodEnd: new Date('2026-04-12'),
        cancelAtPeriodEnd: false,
      },
    ]);

    const data = await getBillingData(MOCK_HEADERS, MOCK_USER_ID);

    expect(data.planId).toBe('pro');
    expect(data.plan.id).toBe('pro');
    expect(data.subscription).not.toBeNull();
    expect(data.subscription!.status).toBe('active');
  });
});
```

**Step 2: Run tests to verify they pass**

Run: `bun test src/billing/billing.server.test.ts`
Expected: ALL PASS

**Step 3: Commit**

```bash
git add src/billing/billing.server.test.ts
git commit -m "test(billing): add tests for getUserPlanContext and getBillingData"
```

---

### Task 6: Write tests for `checkUserPlanLimit`

**Files:**

- Modify: `src/billing/billing.server.test.ts`

**Step 1: Add `checkUserPlanLimit` tests**

Add `checkUserPlanLimit` to the imports at the top:

```ts
import {
  checkUserPlanLimit,
  getBillingData,
  getUserPlanContext,
} from '@/billing/billing.server';
```

Add the following describe block at the end of the file:

```ts
describe('checkUserPlanLimit', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbSelectMock.mockReturnValue({ from: fromMock });
    fromMock.mockReturnValue({ where: whereMock });
  });

  describe('workspace limits', () => {
    it('allows when under limit', async () => {
      mockSubscriptions([{ plan: 'starter', status: 'active' }]);
      // countOwnedWorkspaces returns count.
      whereMock.mockResolvedValueOnce([{ count: 0 }]);

      const result = await checkUserPlanLimit(
        MOCK_HEADERS,
        MOCK_USER_ID,
        'workspace',
      );

      expect(result.allowed).toBe(true);
      expect(result.current).toBe(0);
      expect(result.limit).toBe(1);
      expect(result.planName).toBe('Starter');
      expect(result.upgradePlan).toBeDefined();
    });

    it('blocks when at limit', async () => {
      mockSubscriptions([{ plan: 'starter', status: 'active' }]);
      whereMock.mockResolvedValueOnce([{ count: 1 }]);

      const result = await checkUserPlanLimit(
        MOCK_HEADERS,
        MOCK_USER_ID,
        'workspace',
      );

      expect(result.allowed).toBe(false);
      expect(result.current).toBe(1);
      expect(result.limit).toBe(1);
    });

    it('allows unlimited workspaces for pro', async () => {
      mockSubscriptions([{ plan: 'pro', status: 'active' }]);

      const result = await checkUserPlanLimit(
        MOCK_HEADERS,
        MOCK_USER_ID,
        'workspace',
      );

      // Pro has maxWorkspaces: 5, not -1, so it should still count.
      expect(result.limit).toBe(5);
    });
  });

  describe('member limits', () => {
    it('throws when workspaceId is missing', async () => {
      mockSubscriptions([]);

      await expect(
        checkUserPlanLimit(MOCK_HEADERS, MOCK_USER_ID, 'member'),
      ).rejects.toThrow('workspaceId is required');
    });

    it('allows when no owner found', async () => {
      mockSubscriptions([]);
      // getWorkspaceOwnerUserId returns no rows.
      whereMock.mockResolvedValueOnce([]);

      const result = await checkUserPlanLimit(
        MOCK_HEADERS,
        MOCK_USER_ID,
        'member',
        'ws-123',
      );

      expect(result.allowed).toBe(true);
      expect(result.limit).toBe(-1);
    });

    it('checks member limit against workspace owner plan', async () => {
      // getWorkspaceOwnerUserId returns an owner.
      whereMock.mockResolvedValueOnce([{ userId: 'owner-456' }]);
      // getUserPlanContext for owner — listActiveSubscriptions.
      mockSubscriptions([{ plan: 'starter', status: 'active' }]);
      // countWorkspaceMembers returns count.
      whereMock.mockResolvedValueOnce([{ count: 1 }]);

      const result = await checkUserPlanLimit(
        MOCK_HEADERS,
        MOCK_USER_ID,
        'member',
        'ws-123',
      );

      expect(result.allowed).toBe(false);
      expect(result.current).toBe(1);
      expect(result.limit).toBe(1);
      expect(result.planName).toBe('Starter');
    });
  });
});
```

**Step 2: Run tests**

Run: `bun test src/billing/billing.server.test.ts`
Expected: ALL PASS

**Step 3: Commit**

```bash
git add src/billing/billing.server.test.ts
git commit -m "test(billing): add tests for checkUserPlanLimit"
```

---

### Task 7: Write tests for `reactivateUserSubscription`, `createCheckoutForPlan`, `createUserBillingPortal`, and `getInvoicesForUser`

**Files:**

- Modify: `src/billing/billing.server.test.ts`

**Step 1: Add remaining function imports**

Update the import block:

```ts
import {
  checkUserPlanLimit,
  createCheckoutForPlan,
  createUserBillingPortal,
  getBillingData,
  getInvoicesForUser,
  getUserPlanContext,
  reactivateUserSubscription,
} from '@/billing/billing.server';
```

**Step 2: Add `reactivateUserSubscription` tests**

```ts
describe('reactivateUserSubscription', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('restores the highest-tier active subscription', async () => {
    listActiveSubscriptionsMock.mockResolvedValueOnce([
      { id: 'sub-1', plan: 'starter', status: 'active' },
      { id: 'sub-2', plan: 'pro', status: 'active' },
    ]);
    restoreSubscriptionMock.mockResolvedValueOnce({});

    const result = await reactivateUserSubscription(MOCK_HEADERS, MOCK_USER_ID);

    expect(result).toEqual({ success: true });
    expect(restoreSubscriptionMock).toHaveBeenCalledWith({
      headers: MOCK_HEADERS,
      body: { subscriptionId: 'sub-2' },
    });
  });

  it('throws when no active subscriptions exist', async () => {
    listActiveSubscriptionsMock.mockResolvedValueOnce([
      { id: 'sub-1', plan: 'pro', status: 'canceled' },
    ]);

    await expect(
      reactivateUserSubscription(MOCK_HEADERS, MOCK_USER_ID),
    ).rejects.toThrow('No active subscription found.');
  });
});
```

**Step 3: Add `createCheckoutForPlan` tests**

```ts
describe('createCheckoutForPlan', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls upgradeSubscription with correct params', async () => {
    upgradeSubscriptionMock.mockResolvedValueOnce({
      url: 'https://checkout.stripe.com/session',
      redirect: true,
    });

    const result = await createCheckoutForPlan(MOCK_HEADERS, 'pro', true);

    expect(result).toEqual({
      url: 'https://checkout.stripe.com/session',
      redirect: true,
    });
    expect(upgradeSubscriptionMock).toHaveBeenCalledWith({
      headers: MOCK_HEADERS,
      body: {
        plan: 'pro',
        annual: true,
        successUrl: expect.stringContaining('/billing?success=true'),
        cancelUrl: expect.stringContaining('/billing'),
      },
    });
  });
});
```

**Step 4: Add `createUserBillingPortal` tests**

```ts
describe('createUserBillingPortal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls createBillingPortal with correct params', async () => {
    createBillingPortalMock.mockResolvedValueOnce({
      url: 'https://billing.stripe.com/portal',
      redirect: true,
    });

    const result = await createUserBillingPortal(MOCK_HEADERS);

    expect(result).toEqual({
      url: 'https://billing.stripe.com/portal',
      redirect: true,
    });
    expect(createBillingPortalMock).toHaveBeenCalledWith({
      headers: MOCK_HEADERS,
      body: { returnUrl: expect.stringContaining('/billing') },
    });
  });
});
```

**Step 5: Add `getInvoicesForUser` tests**

```ts
describe('getInvoicesForUser', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbSelectMock.mockReturnValue({ from: fromMock });
    fromMock.mockReturnValue({ where: whereMock });
  });

  it('returns empty array when user has no Stripe customer ID', async () => {
    whereMock.mockResolvedValueOnce([{ stripeCustomerId: null }]);

    const result = await getInvoicesForUser(MOCK_USER_ID);

    expect(result).toEqual([]);
  });
});
```

**Step 6: Run all tests**

Run: `bun test src/billing/billing.server.test.ts`
Expected: ALL PASS

**Step 7: Commit**

```bash
git add src/billing/billing.server.test.ts
git commit -m "test(billing): add tests for remaining extracted billing functions"
```

---

### Task 8: Final verification

**Step 1: Run full checks**

Run: `bun run check`
Expected: No type errors, no lint errors

**Step 2: Run all tests**

Run: `bun test`
Expected: All tests pass

**Step 3: Verify `billing.functions.ts` is thin wrappers only**

Visually inspect `src/billing/billing.functions.ts` — every handler should be 2-4 lines: `requireVerifiedSession()`, `getRequestHeaders()`, delegate to `billing.server.ts`, return.

**Step 4: Verify no business logic remains in `billing.functions.ts`**

Check that `billing.functions.ts` no longer imports:

- `auth` from `@/auth/auth.server`
- `db` from `@/db`
- `Stripe` from `stripe`
- `eq` from `drizzle-orm`
- `userTable` from `@/db/schema`
- `countOwnedWorkspaces`, `countWorkspaceMembers`, `getWorkspaceOwnerUserId`, `getUserActivePlanId`, `getUserSubscriptionDetails`
- `getFreePlan`, `getPlanById`, `getPlanLimitsForPlanId`, `getUpgradePlan`, `resolveUserPlanId`

It should only import from `@/billing/billing.server` and `@/billing/plans` (for Zod schema).

**Step 5: Commit any fixes from verification**
