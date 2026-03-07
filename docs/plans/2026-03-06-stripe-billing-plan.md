# Stripe Billing Integration — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add subscription billing (Starter free tier + Pro paid tier) via Stripe using Better Auth's `@better-auth/stripe` plugin, with plan limit enforcement and a billing management page.

**Architecture:** Centralized plan config in `src/billing/plans.ts` defines tiers, limits, and Stripe price IDs. Better Auth's Stripe plugin handles subscription lifecycle (checkout, webhooks, portal). Server-side org hooks enforce workspace/member limits. Billing page fetches invoices from Stripe API and uses Stripe's hosted checkout/portal for payments and management.

**Tech Stack:** Better Auth `@better-auth/stripe`, Stripe Node SDK, TanStack Start server functions, TanStack Query, shadcn/ui components.

---

## Task 1: Install Stripe Dependencies

**Files:**

- Modify: `package.json`

**Step 1: Install packages**

Run:

```bash
cd /Users/sfung/src/sass-starter-template/.claude/worktrees/stripe-integration
bun add @better-auth/stripe stripe
```

Expected: Two new dependencies added to `package.json`.

**Step 2: Verify installation**

Run:

```bash
bun test
```

Expected: All 10 existing tests still pass.

**Step 3: Commit**

```bash
git add package.json bun.lock
git commit -m "chore(deps): add @better-auth/stripe and stripe packages"
```

---

## Task 2: Create Plan Configuration

This is the single source of truth for plan definitions, limits, and display metadata. Both server-side enforcement and client-side UI import from this file.

**Files:**

- Create: `src/billing/plans.ts`
- Create: `src/billing/plans.test.ts`

**Step 1: Write failing tests for plan helpers**

Create `src/billing/plans.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  FREE_PLAN_ID,
  getHighestTierPlanId,
  getPlanById,
  getPlanByStripePriceId,
  getFreePlan,
  getPlanLimitsForPlanId,
  PLANS,
} from '@/billing/plans';

describe('plans', () => {
  it('exports at least two plans', () => {
    expect(PLANS.length).toBeGreaterThanOrEqual(2);
  });

  it('has exactly one free plan with no stripePriceId', () => {
    const freePlans = PLANS.filter((p) => p.stripePriceId === null);
    expect(freePlans).toHaveLength(1);
    expect(freePlans[0]!.id).toBe(FREE_PLAN_ID);
  });

  it('getPlanById returns the correct plan', () => {
    const plan = getPlanById('starter');
    expect(plan).toBeDefined();
    expect(plan!.name).toBe('Starter');
  });

  it('getPlanById returns undefined for unknown id', () => {
    expect(getPlanById('nonexistent' as never)).toBeUndefined();
  });

  it('getPlanByStripePriceId returns the correct plan', () => {
    const paidPlan = PLANS.find((p) => p.stripePriceId !== null);
    if (!paidPlan) return; // No paid plan configured with real price IDs yet.
    const found = getPlanByStripePriceId(paidPlan.stripePriceId!);
    expect(found).toBeDefined();
    expect(found!.id).toBe(paidPlan.id);
  });

  it('getFreePlan returns the starter plan', () => {
    const free = getFreePlan();
    expect(free.id).toBe(FREE_PLAN_ID);
    expect(free.price).toBe(0);
  });

  it('getPlanLimitsForPlanId returns correct limits for starter', () => {
    const limits = getPlanLimitsForPlanId('starter');
    expect(limits.maxWorkspaces).toBe(1);
    expect(limits.maxMembersPerWorkspace).toBe(1);
  });

  it('getPlanLimitsForPlanId returns higher limits for pro', () => {
    const limits = getPlanLimitsForPlanId('pro-monthly');
    expect(limits.maxWorkspaces).toBeGreaterThan(1);
    expect(limits.maxMembersPerWorkspace).toBeGreaterThan(1);
  });

  it('getPlanLimitsForPlanId falls back to starter for unknown plan', () => {
    const limits = getPlanLimitsForPlanId('nonexistent' as never);
    expect(limits.maxWorkspaces).toBe(1);
  });

  it('pro plans have a higher tier than starter', () => {
    const starter = getPlanById('starter')!;
    const proMonthly = getPlanById('pro-monthly')!;
    const proAnnual = getPlanById('pro-annual')!;
    expect(proMonthly.tier).toBeGreaterThan(starter.tier);
    expect(proAnnual.tier).toBeGreaterThan(starter.tier);
  });

  it('getHighestTierPlanId picks the highest tier', () => {
    expect(getHighestTierPlanId(['starter', 'pro-monthly'])).toBe(
      'pro-monthly',
    );
  });

  it('getHighestTierPlanId falls back to free for empty list', () => {
    expect(getHighestTierPlanId([])).toBe(FREE_PLAN_ID);
  });

  it('getHighestTierPlanId falls back to free for unknown IDs', () => {
    expect(getHighestTierPlanId(['unknown'])).toBe(FREE_PLAN_ID);
  });
});
```

**Step 2: Run tests to verify they fail**

Run:

```bash
bun test src/billing/plans.test.ts
```

Expected: FAIL — module `@/billing/plans` does not exist.

**Step 3: Create the plan config**

Create `src/billing/plans.ts`:

```ts
// ────────────────────────────────────────────────────────────────────────────
// Plan configuration — single source of truth for subscription tiers.
//
// To add a new plan:
//   1. Add its ID to the PlanId union.
//   2. Add an entry to the PLANS array.
//   3. Create the corresponding product + price in Stripe Dashboard.
//   4. Set the stripePriceId to the Stripe price ID (price_xxx).
//   5. Run the app — limit enforcement and UI pick up the new plan automatically.
//
// To add a new limit dimension:
//   1. Add the field to PlanLimits.
//   2. Populate it for every plan in the PLANS array.
//   3. Add enforcement in the appropriate org hook (auth-hooks.server.ts).
// ────────────────────────────────────────────────────────────────────────────

export type PlanId = 'starter' | 'pro-monthly' | 'pro-annual';

export interface PlanLimits {
  /** Maximum workspaces the user can own. -1 = unlimited. */
  maxWorkspaces: number;
  /** Maximum members per workspace. -1 = unlimited. */
  maxMembersPerWorkspace: number;
}

export interface Plan {
  id: PlanId;
  /** Display name shown in UI (e.g. "Starter", "Pro"). */
  name: string;
  /** Explicit tier rank for comparing plans. Higher = more permissive. */
  tier: number;
  /** Stripe price ID. null for the free tier. */
  stripePriceId: string | null;
  /** Price in cents. 0 for free. */
  price: number;
  /** Billing interval. null for the free tier. */
  interval: 'month' | 'year' | null;
  limits: PlanLimits;
  /** Feature bullets shown on the billing page. */
  features: string[];
}

/** Canonical plan ID for the free tier. */
export const FREE_PLAN_ID: PlanId = 'starter';

/** Group name shared by monthly and annual variants of the same tier. */
export type PlanGroup = 'starter' | 'pro';

/** Map a plan ID to its group for display purposes. */
export const PLAN_GROUP: Record<PlanId, PlanGroup> = {
  starter: 'starter',
  'pro-monthly': 'pro',
  'pro-annual': 'pro',
};

const STARTER_LIMITS: PlanLimits = {
  maxWorkspaces: 1,
  maxMembersPerWorkspace: 1,
};

const PRO_LIMITS: PlanLimits = {
  maxWorkspaces: 5,
  maxMembersPerWorkspace: 5,
};

// TODO: Replace placeholder stripePriceId values with real Stripe price IDs
// after creating the products in the Stripe Dashboard.
export const PLANS: readonly Plan[] = [
  {
    id: 'starter',
    name: 'Starter',
    tier: 0,
    stripePriceId: null,
    price: 0,
    interval: null,
    limits: STARTER_LIMITS,
    features: ['1 personal workspace', '1 member'],
  },
  {
    id: 'pro-monthly',
    name: 'Pro',
    tier: 1,
    stripePriceId: 'price_pro_monthly_placeholder',
    price: 0, // TODO: Set actual price in cents.
    interval: 'month',
    limits: PRO_LIMITS,
    features: [
      'Up to 5 workspaces',
      'Up to 5 members per workspace',
      'Priority support',
    ],
  },
  {
    id: 'pro-annual',
    name: 'Pro',
    tier: 1,
    stripePriceId: 'price_pro_annual_placeholder',
    price: 0, // TODO: Set actual price in cents.
    interval: 'year',
    limits: PRO_LIMITS,
    features: [
      'Up to 5 workspaces',
      'Up to 5 members per workspace',
      'Priority support',
      '2 months free',
    ],
  },
] as const;

// ── Helpers ────────────────────────────────────────────────────────────────

export function getPlanById(id: PlanId): Plan | undefined {
  return PLANS.find((p) => p.id === id);
}

export function getPlanByStripePriceId(priceId: string): Plan | undefined {
  return PLANS.find((p) => p.stripePriceId === priceId);
}

export function getFreePlan(): Plan {
  const plan = getPlanById(FREE_PLAN_ID);
  if (!plan) throw new Error('Free plan is not configured.');
  return plan;
}

/**
 * Returns the plan limits for a given plan ID.
 * Falls back to the free plan limits if the plan ID is unknown.
 */
export function getPlanLimitsForPlanId(planId: string): PlanLimits {
  const plan = PLANS.find((p) => p.id === planId);
  return plan?.limits ?? getFreePlan().limits;
}

/**
 * Given multiple plan IDs (e.g. from multiple active subscriptions),
 * returns the one with the highest tier rank.
 * Falls back to FREE_PLAN_ID if the list is empty or all IDs are unknown.
 */
export function getHighestTierPlanId(planIds: string[]): PlanId {
  let best: Plan | undefined;
  for (const id of planIds) {
    const plan = PLANS.find((p) => p.id === id);
    if (plan && (!best || plan.tier > best.tier)) {
      best = plan;
    }
  }
  return best?.id ?? FREE_PLAN_ID;
}
```

**Step 4: Run tests to verify they pass**

Run:

```bash
bun test src/billing/plans.test.ts
```

Expected: All tests PASS.

**Step 5: Commit**

```bash
git add src/billing/plans.ts src/billing/plans.test.ts
git commit -m "feat(billing): add plan configuration with types and helpers"
```

---

## Task 3: Add Stripe Plugin to Better Auth Server

**Files:**

- Modify: `src/auth/auth.server.ts`

**Step 1: Add Stripe plugin imports and config**

At the top of `src/auth/auth.server.ts`, add imports:

```ts
import { stripe } from '@better-auth/stripe';
import Stripe from 'stripe';
import { PLANS } from '@/billing/plans';
```

Create the Stripe client before the `auth` export:

```ts
const stripeClient = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-12-18.acacia',
});
```

Add the `stripe()` plugin to the `plugins` array (before `tanstackStartCookies()`):

```ts
stripe({
  stripeClient,
  stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET!,
  createCustomerOnSignUp: true,
  subscription: {
    enabled: true,
    plans: PLANS.filter((p) => p.stripePriceId !== null).map((p) => ({
      name: p.id,
      priceId: p.stripePriceId!,
    })),
  },
}),
```

**Important:** The `name` field in Better Auth's plan config maps to the `plan` value stored on the subscription and exposed on the session. We use the plan `id` (e.g. `"pro-monthly"`) so we can look it up with `getPlanById()`.

**Step 2: Verify build**

Run:

```bash
bun run typecheck
```

Expected: No TypeScript errors.

**Step 3: Commit**

```bash
git add src/auth/auth.server.ts
git commit -m "feat(billing): add Stripe plugin to Better Auth server config"
```

---

## Task 4: Add Stripe Client Plugin

**Files:**

- Modify: `src/auth/auth-client.ts`

**Step 1: Add stripeClient plugin**

Add import at the top:

```ts
import { stripeClient } from '@better-auth/stripe/client';
```

Add to the `plugins` array:

```ts
stripeClient({
  subscription: true,
}),
```

**Step 2: Verify typecheck**

Run:

```bash
bun run typecheck
```

Expected: No TypeScript errors.

**Step 3: Commit**

```bash
git add src/auth/auth-client.ts
git commit -m "feat(billing): add Stripe client plugin to auth client"
```

---

## Task 5: Generate Database Schema for Stripe Tables

Better Auth's Stripe plugin requires additional tables (stripe customers, subscriptions). These are generated via the Better Auth CLI.

**Files:**

- Modify: `src/db/auth.schema.ts` (auto-generated)

**Step 1: Generate schema**

Run:

```bash
bun run gen-auth-schema
```

This regenerates `src/db/auth.schema.ts` to include the Stripe-related tables (`subscription`, `stripeCustomer`, etc.) based on the current auth config.

**Step 2: Verify the new tables exist in schema**

Run:

```bash
grep -c 'pgTable' src/db/auth.schema.ts
```

Expected: More tables than before (should include `subscription` and related tables).

**Step 3: Push schema to database (dev only)**

Run:

```bash
bun run db:push
```

Expected: New tables created successfully.

**Step 4: Run existing tests to ensure nothing broke**

Run:

```bash
bun test
```

Expected: All tests pass.

**Step 5: Commit**

```bash
git add src/db/auth.schema.ts
git commit -m "chore(db): regenerate auth schema with Stripe tables"
```

---

## Task 6: Add Plan Limit Enforcement to Org Hooks

Enforce workspace and member limits based on the user's subscription plan.

**Files:**

- Create: `src/billing/billing.server.ts`
- Modify: `src/auth/auth.server.ts` (organizationHooks)

**Step 1: Create billing server helpers**

Create `src/billing/billing.server.ts` with functions to look up a user's current plan from the database.

**Important:** This file imports `auth` from `@/auth/auth.server`. The org hooks in `auth.server.ts` must NOT import from this file (would create a circular dependency). Instead, the hooks query the subscription table directly via Drizzle (see Step 2).

```ts
import { getRequestHeaders } from '@tanstack/react-start/server';
import { redirect } from '@tanstack/react-router';
import { eq, and } from 'drizzle-orm';
import { auth } from '@/auth/auth.server';
import { db } from '@/db';
import { subscription as subscriptionTable } from '@/db/schema';
import {
  FREE_PLAN_ID,
  getHighestTierPlanId,
  getPlanLimitsForPlanId,
} from '@/billing/plans';
import type { PlanId, PlanLimits } from '@/billing/plans';

export async function requireVerifiedSession() {
  const headers = getRequestHeaders();
  const session = await auth.api.getSession({ headers });
  if (!session || !session.user.emailVerified) {
    throw redirect({ to: '/signin' });
  }
  return session;
}

/**
 * Returns the active plan ID for a user by querying the subscription table.
 * If multiple active subscriptions exist (e.g. during an upgrade transition),
 * returns the highest-tier plan to give the user the most permissive limits.
 * Falls back to the free plan if no active subscription exists.
 */
export async function getUserActivePlanId(userId: string): Promise<PlanId> {
  const rows = await db
    .select({ plan: subscriptionTable.plan })
    .from(subscriptionTable)
    .where(
      and(
        eq(subscriptionTable.referenceId, userId),
        eq(subscriptionTable.status, 'active'),
      ),
    );

  if (rows.length === 0) return FREE_PLAN_ID;
  return getHighestTierPlanId(rows.map((r) => r.plan));
}

/**
 * Returns the plan limits for a given user based on their subscription.
 */
export async function getUserPlanLimits(userId: string): Promise<PlanLimits> {
  const planId = await getUserActivePlanId(userId);
  return getPlanLimitsForPlanId(planId);
}
```

**Step 2: Add limit enforcement to org hooks**

In `src/auth/auth.server.ts`, the hooks query the subscription table directly via Drizzle — no imports from `billing.server.ts`, avoiding circular dependencies. The hooks only import from `@/billing/plans` (a pure config file with no `auth` dependency) and `@/db`.

Add these imports at the top of `src/auth/auth.server.ts`:

```ts
import { and, eq } from 'drizzle-orm';
import { subscription as subscriptionTable } from '@/db/schema';
import {
  getHighestTierPlanId,
  getPlanLimitsForPlanId,
  FREE_PLAN_ID,
} from '@/billing/plans';
```

Update `beforeCreateOrganization`:

```ts
beforeCreateOrganization: async ({ organization, user }) => {
  if (!isRecord(organization)) return;
  validateWorkspaceFields(organization, 'create');

  // Enforce workspace limit based on user's plan.
  if (user?.id) {
    const rows = await db
      .select({ plan: subscriptionTable.plan })
      .from(subscriptionTable)
      .where(
        and(
          eq(subscriptionTable.referenceId, user.id),
          eq(subscriptionTable.status, 'active'),
        ),
      );
    const planId =
      rows.length > 0
        ? getHighestTierPlanId(rows.map((r) => r.plan))
        : FREE_PLAN_ID;
    const limits = getPlanLimitsForPlanId(planId);

    if (limits.maxWorkspaces !== -1) {
      const workspaces = await auth.api.listOrganizations({
        query: { userId: user.id },
      });
      if (workspaces.length >= limits.maxWorkspaces) {
        throw new APIError('FORBIDDEN', {
          message: `Your plan allows a maximum of ${limits.maxWorkspaces} workspace(s). Please upgrade to create more.`,
        });
      }
    }
  }
},
```

For member/invitation limits, add to the `organizationHooks` section:

```ts
beforeCreateInvitation: async ({ invitation, organization, inviter }) => {
  // Find the workspace owner to check their plan limits.
  const members = await auth.api.listMembers({
    query: { organizationId: organization.id },
  });
  const owner = members.find((m) => m.role === 'owner');
  if (!owner) return;

  const rows = await db
    .select({ plan: subscriptionTable.plan })
    .from(subscriptionTable)
    .where(
      and(
        eq(subscriptionTable.referenceId, owner.userId),
        eq(subscriptionTable.status, 'active'),
      ),
    );
  const planId =
    rows.length > 0
      ? getHighestTierPlanId(rows.map((r) => r.plan))
      : FREE_PLAN_ID;
  const limits = getPlanLimitsForPlanId(planId);

  if (limits.maxMembersPerWorkspace !== -1) {
    if (members.length >= limits.maxMembersPerWorkspace) {
      throw new APIError('FORBIDDEN', {
        message: `This workspace has reached its member limit (${limits.maxMembersPerWorkspace}). The workspace owner needs to upgrade their plan.`,
      });
    }
  }
},
```

**Step 3: Verify typecheck**

Run:

```bash
bun run typecheck
```

Expected: No TypeScript errors.

**Step 4: Run existing tests**

Run:

```bash
bun test
```

Expected: All tests pass (existing tests don't trigger limit enforcement).

**Step 5: Commit**

```bash
git add src/billing/billing.server.ts src/auth/auth.server.ts
git commit -m "feat(billing): add plan limit enforcement for workspaces and members"
```

---

## Task 7: Create Billing Server Functions

These are `createServerFn` wrappers that the billing page calls.

**Files:**

- Create: `src/billing/billing.functions.ts`

**Step 1: Create the server functions file**

Create `src/billing/billing.functions.ts`:

```ts
import { createServerFn } from '@tanstack/react-start';
import Stripe from 'stripe';
import * as z from 'zod';
import { eq, and } from 'drizzle-orm';
import { auth } from '@/auth/auth.server';
import { db } from '@/db';
import { subscription as subscriptionTable } from '@/db/schema';
import { requireVerifiedSession } from '@/billing/billing.server';
import { getHighestTierPlanId, FREE_PLAN_ID } from '@/billing/plans';

const stripeClient = new Stripe(process.env.STRIPE_SECRET_KEY!);

/**
 * Fetches the current user's invoices from Stripe.
 */
export const getInvoices = createServerFn().handler(async () => {
  const session = await requireVerifiedSession();

  // Look up the user's Stripe customer ID.
  const customer = await auth.api.stripeGetCustomer({
    query: { userId: session.user.id },
  });
  if (!customer?.stripeCustomerId) return [];

  const invoices = await stripeClient.invoices.list({
    customer: customer.stripeCustomerId,
    limit: 24,
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
});

const checkoutInput = z.object({
  priceId: z.string().min(1),
  annual: z.boolean().optional(),
});

/**
 * Creates a Stripe Checkout session for subscribing to a plan.
 * Uses auth.api server-side (not authClient, which is client-only).
 */
export const createCheckoutSession = createServerFn()
  .inputValidator(checkoutInput)
  .handler(async ({ data }) => {
    await requireVerifiedSession();

    const result = await auth.api.createSubscription({
      body: {
        priceId: data.priceId,
        successUrl: '/billing?success=true',
        cancelUrl: '/billing',
      },
    });

    return result;
  });

/**
 * Creates a Stripe Customer Portal session for managing subscription.
 */
export const createPortalSession = createServerFn().handler(async () => {
  await requireVerifiedSession();

  const result = await auth.api.createPortalSession({
    body: {
      returnUrl: '/billing',
    },
  });

  return result;
});

/**
 * Reactivates a subscription that was set to cancel at period end.
 * If multiple active subscriptions exist, reactivates the highest-tier one.
 */
export const reactivateSubscription = createServerFn().handler(async () => {
  const session = await requireVerifiedSession();

  // Query subscriptions directly — pick highest tier if multiple exist.
  const rows = await db
    .select({
      plan: subscriptionTable.plan,
      stripeSubscriptionId: subscriptionTable.stripeSubscriptionId,
    })
    .from(subscriptionTable)
    .where(
      and(
        eq(subscriptionTable.referenceId, session.user.id),
        eq(subscriptionTable.status, 'active'),
      ),
    );

  if (rows.length === 0) {
    throw new Error('No active subscription found.');
  }

  const bestPlanId = getHighestTierPlanId(rows.map((r) => r.plan));
  const target = rows.find((r) => r.plan === bestPlanId);
  if (!target?.stripeSubscriptionId) {
    throw new Error('No Stripe subscription ID found.');
  }

  await stripeClient.subscriptions.update(target.stripeSubscriptionId, {
    cancel_at_period_end: false,
  });

  return { success: true };
});
```

**Important notes for the implementer:**

- The exact Better Auth Stripe API methods (`stripeGetCustomer`, `createSubscription`, `createPortalSession`) may differ based on the plugin version. Check the plugin's TypeScript types via autocomplete and adjust method names accordingly.
- All server functions use `auth.api` (server-side), not `authClient` (client-only). The `billing.functions.ts` file is a `*.functions.ts` file, so it may import `*.server.ts` modules.
- The `subscription` table and its column names (e.g. `referenceId`, `plan`, `status`, `stripeSubscriptionId`) come from the auto-generated `auth.schema.ts`. Verify column names after running `gen-auth-schema` in Task 5.

**Step 2: Verify typecheck**

Run:

```bash
bun run typecheck
```

Expected: No TypeScript errors. If there are type errors from Better Auth API methods, adjust the method names based on the actual plugin types.

**Step 3: Commit**

```bash
git add src/billing/billing.functions.ts
git commit -m "feat(billing): add server functions for invoices, checkout, portal, reactivation"
```

---

## Task 8: Build Billing UI — Downgrade Banner Component

**Files:**

- Create: `src/components/billing/billing-downgrade-banner.tsx`

**Step 1: Create the component**

Create `src/components/billing/billing-downgrade-banner.tsx`:

This component is shown when `cancelAtPeriodEnd === true`. It displays a message about the downgrade date and a "Cancel" button (which reactivates the subscription).

Props:

- `periodEnd: Date` — when the subscription ends
- `onReactivate: () => void` — callback to reactivate
- `isReactivating: boolean` — loading state

Use shadcn `Card` or a simple `div` with `Alert`-like styling, and a `Button`.

Format the date using `Intl.DateTimeFormat` for consistency.

Example structure:

```tsx
import { Button } from '@/components/ui/button';

interface BillingDowngradeBannerProps {
  periodEnd: Date;
  onReactivate: () => void;
  isReactivating: boolean;
}

export function BillingDowngradeBanner({
  periodEnd,
  onReactivate,
  isReactivating,
}: BillingDowngradeBannerProps) {
  const formattedDate = new Intl.DateTimeFormat('en-US', {
    month: 'long',
    day: 'numeric',
  }).format(periodEnd);

  return (
    <div className="flex items-center justify-between rounded-lg border p-4">
      <p className="text-sm">
        Your plan will downgrade to Starter on {formattedDate}.
      </p>
      <Button
        variant="outline"
        size="sm"
        onClick={onReactivate}
        disabled={isReactivating}
      >
        {isReactivating ? 'Canceling...' : 'Cancel'}
      </Button>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add src/components/billing/billing-downgrade-banner.tsx
git commit -m "feat(billing): add downgrade banner component"
```

---

## Task 9: Build Billing UI — Plan Cards Component

**Files:**

- Create: `src/components/billing/billing-plan-cards.tsx`

**Step 1: Create the component**

This component shows the current plan and an optional upgrade card side by side.

Props it needs (derived from session subscription data + plan config):

- Current plan info (name, price, interval, next billing date)
- Whether the user can upgrade (and to which plan)
- Callbacks for "Manage" (portal) and "Upgrade" (checkout)
- Loading states

Use shadcn `Card`, `CardHeader`, `CardTitle`, `CardContent`, `Button`.

Two-column grid layout (`grid grid-cols-1 gap-4 md:grid-cols-2`).

**Current Plan card:**

- Title: "Current Plan"
- Body: Plan name + price (e.g. "Pro $X/mo"), next billing cycle date
- Footer: "Manage" outline button → calls portal session

**Upgrade card (conditional):**

- Title: "Upgrade"
- Body: Next tier name + price, feature list
- Footer: "Upgrade" primary button → calls checkout session

For Starter users: "Upgrade" shows Pro with a monthly/annual toggle.
For Pro users: No upgrade card shown (unless a third tier exists).

Include a billing interval toggle (monthly/annual) using shadcn `Toggle` or `Tabs`.

**Step 2: Commit**

```bash
git add src/components/billing/billing-plan-cards.tsx
git commit -m "feat(billing): add plan cards component with current plan and upgrade"
```

---

## Task 10: Build Billing UI — Invoice Table Component

**Files:**

- Create: `src/components/billing/billing-invoice-table.tsx`

**Step 1: Create the component**

Displays the invoice history fetched from Stripe API.

Props:

- `invoices: Array<{ id, date, status, amount, currency, invoiceUrl }>` (from `getInvoices()`)
- Loading/empty states

Use shadcn `Table`, `TableHeader`, `TableRow`, `TableHead`, `TableBody`, `TableCell`.

Columns: Date, Status, Amount, Invoice (View link).

- Date: Format with `Intl.DateTimeFormat` (e.g. "Mar 1, 2026").
- Status: Use a `Badge` (green for "paid", yellow for "open", red for "uncollectible").
- Amount: Format with `Intl.NumberFormat` for currency.
- Invoice: "View" link that opens `invoiceUrl` in a new tab.

Add a month filter using shadcn `Select` — filter invoices by month/year. Default to the current month.

**Step 2: Commit**

```bash
git add src/components/billing/billing-invoice-table.tsx
git commit -m "feat(billing): add invoice history table component"
```

---

## Task 11: Build Billing Page — Wire Everything Together

**Files:**

- Create: `src/components/billing/billing-page.tsx`
- Modify: `src/routes/_protected/_account/billing.tsx`

**Step 1: Create the billing page composition component**

Create `src/components/billing/billing-page.tsx` that:

1. Reads subscription data from the session (via `useSessionQuery()` hook).
2. Fetches invoices using TanStack Query wrapping the `getInvoices` server function.
3. Derives current plan from `session.data?.user.subscription?.plan` → `getPlanById()`.
4. Handles the upgrade, manage, and reactivate actions via mutations calling the server functions.
5. Composes the three sub-components: banner, plan cards, invoice table.

Follow the page layout pattern from `account.tsx`:

```ts
const PAGE_LAYOUT_CLASS =
  'mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-4 md:py-6 lg:px-6';
```

**Step 2: Update the billing route**

Replace the placeholder in `src/routes/_protected/_account/billing.tsx`:

```tsx
import { createFileRoute } from '@tanstack/react-router';
import { BillingPage } from '@/components/billing/billing-page';

export const Route = createFileRoute('/_protected/_account/billing')({
  component: BillingPage,
  staticData: { title: 'Billing' },
});
```

**Step 3: Verify typecheck**

Run:

```bash
bun run typecheck
```

Expected: No TypeScript errors.

**Step 4: Run all tests**

Run:

```bash
bun test
```

Expected: All tests pass (including the plan config tests from Task 2).

**Step 5: Commit**

```bash
git add src/components/billing/billing-page.tsx src/routes/_protected/_account/billing.tsx
git commit -m "feat(billing): wire up billing page with plan cards, banner, and invoices"
```

---

## Task 12: Update Environment Variables

**Files:**

- Modify: `.env.example`

**Step 1: Ensure env vars are documented**

Verify `.env.example` contains:

```
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

These should already be there per the exploration. If not, add them.

**Step 2: Commit (if changed)**

```bash
git add .env.example
git commit -m "chore(env): document Stripe environment variables"
```

---

## Task 13: Final Verification

**Step 1: Run full test suite**

Run:

```bash
bun test
```

Expected: All tests pass.

**Step 2: Run typecheck**

Run:

```bash
bun run typecheck
```

Expected: No errors.

**Step 3: Run lint**

Run:

```bash
bun run lint
```

Expected: No lint errors (or only pre-existing ones).

**Step 4: Verify build**

Run:

```bash
bun run build
```

Expected: Build succeeds.

---

## Implementation Notes

### Better Auth Stripe API Discovery

The exact method names on `auth.api` for Stripe operations may vary by plugin version. When implementing Task 7 (server functions), use TypeScript autocomplete to discover:

- How to get a user's Stripe customer ID.
- How to list active subscriptions for a user.
- How to create checkout sessions server-side.
- How to create portal sessions server-side.

If the plugin exposes client-only methods, use the Stripe SDK directly for server-side operations.

### Stripe Dashboard Setup (Manual, Outside Code)

Before testing end-to-end, you need to:

1. Create a "Pro" product in Stripe Dashboard with monthly and annual prices.
2. Copy the `price_xxx` IDs into `src/billing/plans.ts`.
3. Set up a webhook endpoint pointing to `https://<your-domain>/api/auth/stripe/webhook`.
4. Enable the required webhook events: `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_succeeded`, `invoice.payment_failed`.
5. Copy the webhook signing secret to `STRIPE_WEBHOOK_SECRET`.

### Subscription Data on Session

After the Stripe plugin is active, `session.data?.user.subscription` should contain:

- `plan`: The plan name (our `PlanId`, e.g. `"pro-monthly"`).
- `status`: Stripe subscription status (`"active"`, `"canceled"`, etc.).
- `periodEnd`: End of current billing period.
- `cancelAtPeriodEnd`: Whether cancellation is scheduled.

If the session shape differs, adjust the billing page to read from the correct path.
