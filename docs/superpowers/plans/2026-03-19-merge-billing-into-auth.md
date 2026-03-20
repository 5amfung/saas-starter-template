# Merge Billing Into Auth — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Merge `@workspace/billing` into `@workspace/auth` so that plan enforcement is built into `createAuth`, `init.ts` is simplified, and the billing package is eliminated.

**Architecture:** Move plan definitions and billing queries into `@workspace/auth`. Internalize limit enforcement into org hooks inside `createAuth`. Expose billing query methods via `auth.billing.*`. Delete `packages/billing/`.

**Tech Stack:** Better Auth, Stripe, Drizzle ORM, pnpm workspaces, TypeScript, Vitest

**Spec:** `docs/superpowers/specs/2026-03-19-merge-billing-into-auth-design.md`

**Important:** All commands must be run from the project root. Use `pnpm` only — never `npm`, `yarn`, or `npx`.

---

## Chunk 1: Move Plans Into Auth Package

### Task 1: Move `plans.ts` and its tests to `@workspace/auth`

**Files:**

- Create: `packages/auth/src/plans.ts` (copy from `packages/billing/src/plans.ts`)
- Create: `packages/auth/src/plans.test.ts` (copy from `packages/billing/src/plans.test.ts`)

- [ ] **Step 1: Copy `plans.ts` to auth package**

Copy `packages/billing/src/plans.ts` to `packages/auth/src/plans.ts`. The file contents are identical — no modifications needed. This is a pure move.

- [ ] **Step 2: Copy `plans.test.ts` to auth package**

Copy `packages/billing/src/plans.test.ts` to `packages/auth/src/plans.test.ts`. The file uses relative imports (`./plans`) so no import changes needed.

- [ ] **Step 3: Run the plan tests in the auth package**

Run: `pnpm --filter @workspace/auth test src/plans.test.ts`

Expected: All 18 tests pass.

- [ ] **Step 4: Commit**

```bash
git add packages/auth/src/plans.ts packages/auth/src/plans.test.ts
git commit -m "feat(auth): move plan definitions and tests from billing to auth package"
```

---

### Task 2: Create `billing.server.ts` in auth package (exported utilities)

**Files:**

- Create: `packages/auth/src/billing.server.ts`

This file contains only the functions that apps need: `getInvoicesForUser`, `resolveSubscriptionDetails`, and the billing query helpers exposed via `auth.billing.*`. The limit enforcement functions (`checkWorkspaceLimit`, `checkMemberLimit`) will be inlined into `createAuth` in Task 4.

- [ ] **Step 1: Create `packages/auth/src/billing.server.ts`**

```typescript
import Stripe from 'stripe';
import { and, count, eq } from 'drizzle-orm';
import {
  member as memberTable,
  subscription as subscriptionTable,
  user as userTable,
} from '@workspace/db/schema';
import type { Database } from '@workspace/db';
import { resolveUserPlanId } from './plans';
import type { PlanId } from './plans';

/**
 * Creates billing query helpers with closed-over database and Stripe client.
 * Returned by createAuth as auth.billing.
 */
export function createBillingHelpers(db: Database, stripeSecretKey: string) {
  const stripeClient = new Stripe(stripeSecretKey);

  /** Resolves a user's plan ID by querying the subscription table directly. */
  async function resolveUserPlanIdFromDb(userId: string): Promise<PlanId> {
    const rows = await db
      .select({
        plan: subscriptionTable.plan,
        status: subscriptionTable.status,
      })
      .from(subscriptionTable)
      .where(eq(subscriptionTable.referenceId, userId));
    return resolveUserPlanId(
      rows.filter(
        (r): r is { plan: string; status: string } => r.status !== null
      )
    );
  }

  /** Counts the number of workspaces where the user is an owner. */
  async function countOwnedWorkspaces(userId: string): Promise<number> {
    const [result] = await db
      .select({ count: count() })
      .from(memberTable)
      .where(
        and(eq(memberTable.userId, userId), eq(memberTable.role, 'owner'))
      );
    return result.count;
  }

  /** Returns the owner's user ID for a workspace, or null if none found. */
  async function getWorkspaceOwnerUserId(
    workspaceId: string
  ): Promise<string | null> {
    const rows = await db
      .select({ userId: memberTable.userId })
      .from(memberTable)
      .where(
        and(
          eq(memberTable.organizationId, workspaceId),
          eq(memberTable.role, 'owner')
        )
      );
    if (rows.length === 0) return null;
    return rows[0].userId;
  }

  /** Counts the number of members in a workspace. */
  async function countWorkspaceMembers(workspaceId: string): Promise<number> {
    const [result] = await db
      .select({ count: count() })
      .from(memberTable)
      .where(eq(memberTable.organizationId, workspaceId));
    return result.count;
  }

  /** Fetches a user's invoices from Stripe (past 12 months). */
  async function getInvoicesForUser(userId: string) {
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

  return {
    resolveUserPlanIdFromDb,
    countOwnedWorkspaces,
    getWorkspaceOwnerUserId,
    countWorkspaceMembers,
    getInvoicesForUser,
  };
}

export type AuthBilling = ReturnType<typeof createBillingHelpers>;

/**
 * Extracts subscription details from an in-memory subscription list.
 * Pure function — no DB or API calls.
 */
export function resolveSubscriptionDetails(
  subscriptions: ReadonlyArray<{
    plan: string;
    status: string;
    periodEnd?: Date | null;
    cancelAtPeriodEnd?: boolean | null;
    cancelAt?: Date | null;
  }>,
  planId: PlanId
): {
  status: string;
  periodEnd: Date | null;
  cancelAtPeriodEnd: boolean;
  cancelAt: Date | null;
} | null {
  const active = subscriptions.find(
    (s) =>
      (s.status === 'active' || s.status === 'trialing') && s.plan === planId
  );
  if (!active) return null;

  return {
    status: active.status,
    periodEnd: active.periodEnd ?? null,
    cancelAtPeriodEnd: active.cancelAtPeriodEnd ?? false,
    cancelAt: active.cancelAt ?? null,
  };
}
```

- [ ] **Step 2: Run typecheck on auth package**

Run: `pnpm --filter @workspace/auth typecheck`

Expected: PASS (no errors).

- [ ] **Step 3: Commit**

```bash
git add packages/auth/src/billing.server.ts
git commit -m "feat(auth): add billing helpers and subscription details to auth package"
```

---

### Task 3: Move billing server tests to auth package

**Files:**

- Create: `packages/auth/src/billing.server.test.ts` (adapted from `packages/billing/src/billing.server.test.ts`)

- [ ] **Step 1: Create `packages/auth/src/billing.server.test.ts`**

Adapt the test from `packages/billing/src/billing.server.test.ts`. Key changes:

- Import `createBillingHelpers` instead of `createBillingService`
- Import `resolveSubscriptionDetails` from `./billing.server` instead of `./billing.server`
- The mock structure and test logic remain identical

```typescript
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createBillingHelpers,
  resolveSubscriptionDetails,
} from './billing.server';

// ── Hoisted mocks ──────────────────────────────────────────────────────────

const { dbSelectMock, stripeInvoicesListMock } = vi.hoisted(() => ({
  dbSelectMock: vi.fn(),
  stripeInvoicesListMock: vi.fn(),
}));

// ── Module mocks ───────────────────────────────────────────────────────────

vi.mock('@workspace/db/schema', () => ({
  member: 'member',
  subscription: 'subscription',
  user: 'user',
}));

vi.mock('drizzle-orm', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    and: vi.fn((...args: Array<unknown>) => args),
    count: vi.fn(() => 'count'),
    eq: vi.fn((a: unknown, b: unknown) => [a, b]),
  };
});

vi.mock('stripe', () => {
  function StripeMock() {
    // @ts-expect-error -- mock constructor assigns invoices property.
    this.invoices = { list: stripeInvoicesListMock };
  }
  return { default: StripeMock };
});

/**
 * Creates a chainable mock for Drizzle ORM's query patterns.
 */
function mockDbChain(
  selectMock: ReturnType<typeof vi.fn>,
  result: Array<unknown>
) {
  const limitMock = vi.fn().mockResolvedValue(result);
  const whereResult = Object.assign(Promise.resolve(result), {
    limit: limitMock,
  });
  const whereMock = vi.fn().mockReturnValue(whereResult);
  const fromMock = vi.fn().mockReturnValue({ where: whereMock });
  selectMock.mockReturnValue({ from: fromMock });
  return { fromMock, whereMock, limitMock };
}

const TEST_USER_ID = 'user_123';

// ── Tests ──────────────────────────────────────────────────────────────────

describe('resolveSubscriptionDetails', () => {
  it('returns null when no matching subscription exists', () => {
    const result = resolveSubscriptionDetails([], 'starter');
    expect(result).toBeNull();
  });

  it('returns null when subscription plan does not match', () => {
    const result = resolveSubscriptionDetails(
      [{ plan: 'pro', status: 'active' }],
      'starter'
    );
    expect(result).toBeNull();
  });

  it('extracts details from matching active subscription', () => {
    const periodEnd = new Date('2026-04-12');
    const result = resolveSubscriptionDetails(
      [
        {
          plan: 'pro',
          status: 'active',
          periodEnd,
          cancelAtPeriodEnd: false,
          cancelAt: null,
        },
      ],
      'pro'
    );
    expect(result).toEqual({
      status: 'active',
      periodEnd,
      cancelAtPeriodEnd: false,
      cancelAt: null,
    });
  });

  it('defaults missing optional fields to null/false', () => {
    const result = resolveSubscriptionDetails(
      [{ plan: 'pro', status: 'trialing' }],
      'pro'
    );
    expect(result).toEqual({
      status: 'trialing',
      periodEnd: null,
      cancelAtPeriodEnd: false,
      cancelAt: null,
    });
  });
});

describe('createBillingHelpers', () => {
  let helpers: ReturnType<typeof createBillingHelpers>;

  beforeEach(() => {
    vi.clearAllMocks();
    const mockDb = { select: dbSelectMock } as never;
    helpers = createBillingHelpers(mockDb, 'sk_test_fake');
  });

  describe('resolveUserPlanIdFromDb', () => {
    it('returns free when no subscriptions exist', async () => {
      mockDbChain(dbSelectMock, []);

      const planId = await helpers.resolveUserPlanIdFromDb(TEST_USER_ID);
      expect(planId).toBe('free');
    });

    it('returns pro for active pro subscription', async () => {
      mockDbChain(dbSelectMock, [{ plan: 'pro', status: 'active' }]);

      const planId = await helpers.resolveUserPlanIdFromDb(TEST_USER_ID);
      expect(planId).toBe('pro');
    });

    it('filters out rows with null status', async () => {
      mockDbChain(dbSelectMock, [{ plan: 'pro', status: null }]);

      const planId = await helpers.resolveUserPlanIdFromDb(TEST_USER_ID);
      expect(planId).toBe('free');
    });
  });

  describe('countOwnedWorkspaces', () => {
    it('returns the count from the database', async () => {
      mockDbChain(dbSelectMock, [{ count: 3 }]);

      const result = await helpers.countOwnedWorkspaces(TEST_USER_ID);
      expect(result).toBe(3);
    });
  });

  describe('getWorkspaceOwnerUserId', () => {
    it('returns null when no owner found', async () => {
      mockDbChain(dbSelectMock, []);

      const result = await helpers.getWorkspaceOwnerUserId('ws_123');
      expect(result).toBeNull();
    });

    it('returns owner userId', async () => {
      mockDbChain(dbSelectMock, [{ userId: 'owner_456' }]);

      const result = await helpers.getWorkspaceOwnerUserId('ws_123');
      expect(result).toBe('owner_456');
    });
  });

  describe('countWorkspaceMembers', () => {
    it('returns the count from the database', async () => {
      mockDbChain(dbSelectMock, [{ count: 5 }]);

      const result = await helpers.countWorkspaceMembers('ws_123');
      expect(result).toBe(5);
    });
  });

  describe('getInvoicesForUser', () => {
    it('returns empty array when no stripeCustomerId', async () => {
      mockDbChain(dbSelectMock, [{ stripeCustomerId: null }]);

      const result = await helpers.getInvoicesForUser(TEST_USER_ID);

      expect(result).toEqual([]);
      expect(stripeInvoicesListMock).not.toHaveBeenCalled();
    });
  });

  describe('checkWorkspaceLimit — via resolveUserPlanIdFromDb + countOwnedWorkspaces', () => {
    // Note: checkWorkspaceLimit moves into createAuth as a private function.
    // These tests verify the underlying helpers that power it.
    it('resolveUserPlanIdFromDb + countOwnedWorkspaces compose correctly', async () => {
      // First call: resolve plan (free).
      const where1 = vi.fn().mockResolvedValue([]);
      const from1 = vi.fn().mockReturnValue({ where: where1 });

      // Second call: count workspaces (1 — at free limit).
      const whereResult2 = Object.assign(Promise.resolve([{ count: 1 }]), {
        limit: vi.fn().mockResolvedValue([{ count: 1 }]),
      });
      const where2 = vi.fn().mockReturnValue(whereResult2);
      const from2 = vi.fn().mockReturnValue({ where: where2 });

      dbSelectMock
        .mockReturnValueOnce({ from: from1 })
        .mockReturnValueOnce({ from: from2 });

      const planId = await helpers.resolveUserPlanIdFromDb(TEST_USER_ID);
      expect(planId).toBe('free');

      const count = await helpers.countOwnedWorkspaces(TEST_USER_ID);
      expect(count).toBe(1);
    });
  });
});
```

- [ ] **Step 2: Run billing server tests in auth package**

Run: `pnpm --filter @workspace/auth test src/billing.server.test.ts`

Expected: All tests pass.

- [ ] **Step 3: Commit**

```bash
git add packages/auth/src/billing.server.test.ts
git commit -m "test(auth): add billing helper tests moved from billing package"
```

---

## Chunk 2: Refactor `createAuth` and Simplify Config

### Task 4: Update `packages/auth/package.json` exports

**Files:**

- Modify: `packages/auth/package.json`

- [ ] **Step 1: Add `./plans` and `./billing` sub-path exports**

Add to the `exports` field in `packages/auth/package.json`:

```json
"./plans": "./src/plans.ts",
"./billing": "./src/billing.server.ts"
```

The full exports field should be:

```json
{
  "exports": {
    ".": "./src/index.ts",
    "./server": "./src/auth.server.ts",
    "./client": "./src/auth-client.ts",
    "./validators": "./src/validators.ts",
    "./schemas": "./src/schemas.ts",
    "./plans": "./src/plans.ts",
    "./billing": "./src/billing.server.ts"
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/auth/package.json
git commit -m "feat(auth): add plans and billing sub-path exports"
```

---

### Task 5: Refactor `createAuth` — internalize billing, simplify config

**Files:**

- Modify: `packages/auth/src/auth.server.ts`

This is the core refactor. Changes:

1. Import `PLANS` and `getPlanLimitsForPlanId` from `./plans`
2. Import `createBillingHelpers` from `./billing.server`
3. Remove `StripePlanConfig` interface (no longer public)
4. Remove `AuthHooks` interface (limit enforcement is internal)
5. Simplify `AuthConfig` — remove `stripe.plans` and `hooks`
6. Build Stripe plan config internally from `PLANS` + `process.env`
7. Move limit enforcement directly into org hooks
8. Return `{ ...auth, billing }` so apps can access `auth.billing.*`

- [ ] **Step 1: Update imports at top of `auth.server.ts`**

Add these imports after the existing imports:

```typescript
import { PLANS, getPlanLimitsForPlanId } from './plans';
import { createBillingHelpers } from './billing.server';
```

- [ ] **Step 2: Remove `StripePlanConfig` interface**

Delete the `StripePlanConfig` interface (lines 29-34):

```typescript
// DELETE THIS:
/** Shape of a subscription plan passed to the Better Auth Stripe plugin. */
export interface StripePlanConfig {
  name: string;
  priceId: string;
  annualDiscountPriceId?: string;
}
```

- [ ] **Step 3: Simplify `AuthConfig` — remove `stripe.plans` and `hooks`**

Replace the `AuthConfig` interface with:

```typescript
export interface AuthConfig {
  db: Database;
  emailClient: EmailClient;
  baseUrl: string;
  secret: string;
  google: {
    clientId: string;
    clientSecret: string;
  };
  stripe: {
    secretKey: string;
    webhookSecret: string;
  };
  adminUserIds?: Array<string>;
  trustedOrigins?: Array<string>;
  /** Logger callback. Falls back to console.log when not provided. */
  logger?: (
    level: 'debug' | 'info' | 'warn' | 'error',
    message: string,
    meta?: Record<string, unknown>
  ) => void;
  /** Returns request headers in the current server context. Used by auth-emails to build email request context. */
  getRequestHeaders?: () => Headers;
}
```

- [ ] **Step 4: Remove `AuthHooks` interface**

Delete the `AuthHooks` interface entirely (lines 64-72).

- [ ] **Step 5: Build Stripe plans internally + create billing helpers inside `createAuth`**

At the top of the `createAuth` function body, after `const stripeClient = new Stripe(config.stripe.secretKey);`, add:

```typescript
// Build Stripe plan config from PLANS — reads price IDs from process.env.
const stripePlans = PLANS.filter((p) => p.pricing !== null).map((p) => {
  const key = p.id.toUpperCase();
  return {
    name: p.id,
    priceId: process.env[`STRIPE_${key}_MONTHLY_PRICE_ID`]!,
    annualDiscountPriceId: process.env[`STRIPE_${key}_ANNUAL_PRICE_ID`]!,
  };
});

// Create billing helpers for limit enforcement and app-level queries.
const billing = createBillingHelpers(config.db, config.stripe.secretKey);
```

- [ ] **Step 6: Replace Stripe plugin's `plans` config**

In the `stripe()` plugin config, change:

```typescript
// Before:
plans: config.stripe.plans,

// After:
plans: stripePlans,
```

- [ ] **Step 7: Replace org hook delegation with direct limit checks**

In the `organizationHooks.beforeCreateOrganization` handler, replace the hook delegation:

```typescript
// Before:
if (user.id && config.hooks?.beforeCreateOrganization) {
  await config.hooks.beforeCreateOrganization(user.id, organization);
}

// After:
if (user.id) {
  const planId = await billing.resolveUserPlanIdFromDb(user.id);
  const limits = getPlanLimitsForPlanId(planId);
  if (limits.maxWorkspaces === -1) return;
  const workspaceCount = await billing.countOwnedWorkspaces(user.id);
  if (workspaceCount >= limits.maxWorkspaces) {
    throw new APIError('FORBIDDEN', {
      message: `Your plan allows a maximum of ${limits.maxWorkspaces} workspace(s). Please upgrade to create more.`,
    });
  }
}
```

In the `organizationHooks.beforeCreateInvitation` handler, replace:

```typescript
// Before:
if (config.hooks?.beforeCreateInvitation) {
  await config.hooks.beforeCreateInvitation(organization.id);
}

// After:
const owner = await billing.getWorkspaceOwnerUserId(organization.id);
if (!owner) return;
const planId = await billing.resolveUserPlanIdFromDb(owner);
const limits = getPlanLimitsForPlanId(planId);
if (limits.maxMembersPerWorkspace === -1) return;
const memberCount = await billing.countWorkspaceMembers(organization.id);
if (memberCount >= limits.maxMembersPerWorkspace) {
  throw new APIError('FORBIDDEN', {
    message: `This workspace has reached its member limit (${limits.maxMembersPerWorkspace}). The workspace owner needs to upgrade their plan.`,
  });
}
```

- [ ] **Step 8: Return auth with billing helpers**

Change the return statement:

```typescript
// Before:
return auth;

// After:
return Object.assign(auth, { billing });
```

- [ ] **Step 9: Run typecheck on auth package**

Run: `pnpm --filter @workspace/auth typecheck`

Expected: PASS.

- [ ] **Step 10: Run all auth package tests**

Run: `pnpm --filter @workspace/auth test`

Expected: All tests pass.

- [ ] **Step 11: Commit**

```bash
git add packages/auth/src/auth.server.ts
git commit -m "feat(auth): internalize billing enforcement and simplify AuthConfig"
```

---

### Task 6: Update `packages/auth/src/index.ts` barrel exports

**Files:**

- Modify: `packages/auth/src/index.ts`

- [ ] **Step 1: Remove `AuthHooks` and `StripePlanConfig` from re-exports**

Change:

```typescript
export type {
  AuthConfig,
  AuthHooks,
  Auth,
  StripePlanConfig,
} from './auth.server';
```

To:

```typescript
export type { AuthConfig, Auth } from './auth.server';
```

- [ ] **Step 2: Add plan type re-exports for client-safe access**

Add at the end of `index.ts`:

```typescript
export type { PlanId, Plan, PlanLimits, PlanPricing } from './plans';
```

- [ ] **Step 3: Add billing type re-export**

```typescript
export type { AuthBilling } from './billing.server';
```

- [ ] **Step 4: Commit**

```bash
git add packages/auth/src/index.ts
git commit -m "refactor(auth): update barrel exports — remove AuthHooks/StripePlanConfig, add plan types"
```

---

## Chunk 3: Update App Consumers and Delete Billing Package

### Task 7: Simplify `apps/web/src/init.ts`

**Files:**

- Modify: `apps/web/src/init.ts`

- [ ] **Step 1: Rewrite `init.ts`**

Replace the entire file with:

```typescript
import { createDb } from '@workspace/db';
import { createEmailClient } from '@workspace/email';
import { createAuth } from '@workspace/auth/server';
import { getRequestHeaders } from '@tanstack/react-start/server';
import { logger } from '@/lib/logger';

export const db = createDb(process.env.DATABASE_URL!);

export const emailClient = createEmailClient({
  apiKey: process.env.RESEND_API_KEY!,
  fromEmail: process.env.RESEND_FROM_EMAIL!,
  replyToEmail: process.env.RESEND_REPLY_TO_EMAIL,
  appName: process.env.VITE_APP_NAME || 'App',
  devPrefix: process.env.NODE_ENV !== 'production',
});

export const auth = createAuth({
  db,
  emailClient,
  baseUrl: process.env.BETTER_AUTH_URL!,
  secret: process.env.BETTER_AUTH_SECRET!,
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID!,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
  },
  stripe: {
    secretKey: process.env.STRIPE_SECRET_KEY!,
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET!,
  },
  logger,
  getRequestHeaders,
});
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/init.ts
git commit -m "refactor(web): simplify init.ts — remove billing wiring and hook injection"
```

---

### Task 8: Update `apps/web/src/billing/billing.server.ts` imports

**Files:**

- Modify: `apps/web/src/billing/billing.server.ts`

- [ ] **Step 1: Replace imports**

Change:

```typescript
import {
  getFreePlan,
  getPlanById,
  getPlanLimitsForPlanId,
  getUpgradePlan,
  resolveUserPlanId,
} from '@workspace/billing/plans';
import { resolveSubscriptionDetails } from '@workspace/billing/server';
import type { Plan, PlanId, PlanLimits } from '@workspace/billing/plans';
import { auth, billingService } from '@/init';
```

To:

```typescript
import {
  getFreePlan,
  getPlanById,
  getPlanLimitsForPlanId,
  getUpgradePlan,
  resolveUserPlanId,
} from '@workspace/auth/plans';
import { resolveSubscriptionDetails } from '@workspace/auth/billing';
import type { Plan, PlanId, PlanLimits } from '@workspace/auth/plans';
import { auth } from '@/init';
```

- [ ] **Step 2: Replace all `billingService.*` calls with `auth.billing.*`**

Find and replace throughout the file:

- `billingService.countOwnedWorkspaces` → `auth.billing.countOwnedWorkspaces`
- `billingService.countWorkspaceMembers` → `auth.billing.countWorkspaceMembers`
- `billingService.getWorkspaceOwnerUserId` → `auth.billing.getWorkspaceOwnerUserId`

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/billing/billing.server.ts
git commit -m "refactor(web): update billing.server.ts imports from @workspace/billing to @workspace/auth"
```

---

### Task 9: Update `apps/web/src/billing/billing.functions.ts` imports

**Files:**

- Modify: `apps/web/src/billing/billing.functions.ts`

- [ ] **Step 1: Replace imports**

Change:

```typescript
import type { PlanId } from '@workspace/billing/plans';
import { PLANS } from '@workspace/billing/plans';
```

To:

```typescript
import type { PlanId } from '@workspace/auth/plans';
import { PLANS } from '@workspace/auth/plans';
```

- [ ] **Step 2: Replace `billingService` with `auth.billing`**

Change:

```typescript
import { billingService } from '@/init';
```

To:

```typescript
import { auth } from '@/init';
```

And in `getInvoices` handler, change:

```typescript
return billingService.getInvoicesForUser(session.user.id);
```

To:

```typescript
return auth.billing.getInvoicesForUser(session.user.id);
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/billing/billing.functions.ts
git commit -m "refactor(web): update billing.functions.ts imports"
```

---

### Task 10: Update billing UI component imports

**Files:**

- Modify: `apps/web/src/components/billing/billing-plan-cards.tsx`
- Modify: `apps/web/src/components/billing/billing-page.tsx`
- Modify: `apps/web/src/components/billing/upgrade-prompt-dialog.tsx`

- [ ] **Step 1: Update `billing-plan-cards.tsx`**

Change:

```typescript
import { formatPlanPrice, getPlanFeatures } from '@workspace/billing/plans';
import type { Plan, PlanId } from '@workspace/billing/plans';
```

To:

```typescript
import { formatPlanPrice, getPlanFeatures } from '@workspace/auth/plans';
import type { Plan, PlanId } from '@workspace/auth/plans';
```

- [ ] **Step 2: Update `billing-page.tsx`**

Change:

```typescript
import { getUpgradePlan } from '@workspace/billing/plans';
import type { PlanId } from '@workspace/billing/plans';
```

To:

```typescript
import { getUpgradePlan } from '@workspace/auth/plans';
import type { PlanId } from '@workspace/auth/plans';
```

- [ ] **Step 3: Update `upgrade-prompt-dialog.tsx`**

Change:

```typescript
import { formatPlanPrice, getPlanFeatures } from '@workspace/billing/plans';
import type { Plan } from '@workspace/billing/plans';
```

To:

```typescript
import { formatPlanPrice, getPlanFeatures } from '@workspace/auth/plans';
import type { Plan } from '@workspace/auth/plans';
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/billing/billing-plan-cards.tsx apps/web/src/components/billing/billing-page.tsx apps/web/src/components/billing/upgrade-prompt-dialog.tsx
git commit -m "refactor(web): update billing UI component imports to @workspace/auth/plans"
```

---

### Task 11: Update hook imports

**Files:**

- Modify: `apps/web/src/hooks/use-upgrade-prompt.ts`
- Modify: `apps/web/src/hooks/use-upgrade-prompt.test.ts`

- [ ] **Step 1: Update `use-upgrade-prompt.ts`**

Change:

```typescript
import type { Plan, PlanId } from '@workspace/billing/plans';
```

To:

```typescript
import type { Plan, PlanId } from '@workspace/auth/plans';
```

- [ ] **Step 2: Update `use-upgrade-prompt.test.ts`**

Change:

```typescript
import type { Plan } from '@workspace/billing/plans';
```

To:

```typescript
import type { Plan } from '@workspace/auth/plans';
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/hooks/use-upgrade-prompt.ts apps/web/src/hooks/use-upgrade-prompt.test.ts
git commit -m "refactor(web): update upgrade prompt hook imports to @workspace/auth/plans"
```

---

### Task 12: Update `apps/web/src/billing/billing.server.test.ts` mocks

**Files:**

- Modify: `apps/web/src/billing/billing.server.test.ts`

- [ ] **Step 1: Restructure the `@/init` mock**

The mock currently exports both `auth` and `billingService` separately. After the merge, `billingService` methods live under `auth.billing`. Change:

```typescript
vi.mock('@/init', () => ({
  auth: {
    api: {
      listActiveSubscriptions: listActiveSubscriptionsMock,
      createBillingPortal: createBillingPortalMock,
      upgradeSubscription: upgradeSubscriptionMock,
      restoreSubscription: restoreSubscriptionMock,
      getSession: getSessionMock,
    },
  },
  billingService: {
    countOwnedWorkspaces: countOwnedWorkspacesMock,
    countWorkspaceMembers: countWorkspaceMembersMock,
    getWorkspaceOwnerUserId: getWorkspaceOwnerUserIdMock,
  },
}));
```

To:

```typescript
vi.mock('@/init', () => ({
  auth: {
    api: {
      listActiveSubscriptions: listActiveSubscriptionsMock,
      createBillingPortal: createBillingPortalMock,
      upgradeSubscription: upgradeSubscriptionMock,
      restoreSubscription: restoreSubscriptionMock,
      getSession: getSessionMock,
    },
    billing: {
      countOwnedWorkspaces: countOwnedWorkspacesMock,
      countWorkspaceMembers: countWorkspaceMembersMock,
      getWorkspaceOwnerUserId: getWorkspaceOwnerUserIdMock,
    },
  },
}));
```

- [ ] **Step 2: Run the test**

Run: `pnpm --filter @workspace/web test src/billing/billing.server.test.ts`

Expected: All tests pass.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/billing/billing.server.test.ts
git commit -m "test(web): restructure billing test mocks — billingService → auth.billing"
```

---

### Task 13: Update config files and remove billing package

**Files:**

- Modify: `apps/web/package.json` — remove `@workspace/billing` dependency
- Modify: `apps/web/tsconfig.json` — remove billing path aliases
- Delete: `packages/billing/` — entire directory

- [ ] **Step 1: Remove `@workspace/billing` from `apps/web/package.json`**

Remove the line `"@workspace/billing": "workspace:*"` from `dependencies`.

- [ ] **Step 2: Remove billing path aliases from `apps/web/tsconfig.json`**

Remove these two lines from `compilerOptions.paths`:

```json
"@workspace/billing": ["../../packages/billing/src/index.ts"],
"@workspace/billing/*": ["../../packages/billing/src/*"],
```

- [ ] **Step 3: Delete `packages/billing/` directory**

```bash
rm -rf packages/billing
```

- [ ] **Step 4: Run `pnpm install` to regenerate lockfile**

Run: `pnpm install`

Expected: Completes without errors. `@workspace/billing` removed from lockfile.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "refactor: remove @workspace/billing package — merged into @workspace/auth"
```

---

## Chunk 4: Verification

### Task 14: Full verification

- [ ] **Step 1: Run typecheck on auth package**

Run: `pnpm --filter @workspace/auth typecheck`

Expected: PASS.

- [ ] **Step 2: Run all auth package tests**

Run: `pnpm --filter @workspace/auth test`

Expected: All tests pass.

- [ ] **Step 3: Run typecheck on web app**

Run: `pnpm run --filter ./apps/web typecheck`

Expected: PASS (or only pre-existing errors unrelated to billing).

- [ ] **Step 4: Run all web app tests**

Run: `pnpm --filter @workspace/web test`

Expected: All tests pass.

- [ ] **Step 5: Run lint**

Run: `pnpm run lint`

Expected: PASS.

- [ ] **Step 6: Verify no remaining `@workspace/billing` references**

Run: `grep -r "@workspace/billing" --include="*.ts" --include="*.tsx" --include="*.json" apps/ packages/`

Expected: No matches (zero output).

- [ ] **Step 7: Commit any lint fixes if needed**

```bash
git add -A
git commit -m "chore: fix lint issues from billing-to-auth merge"
```
