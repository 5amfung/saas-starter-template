# Merge Billing Into Auth Package

**Date**: 2026-03-19
**Status**: Reviewed

## Problem

The `@workspace/billing` and `@workspace/auth` packages are tightly coupled at the data layer — billing queries `subscription`, `member`, and `organization` tables that are all owned by Better Auth's schema. The separate package boundary creates artificial indirection:

- `init.ts` must wire billing hooks into auth via config, creating an ordering dependency ("billing must be created before auth")
- `AuthConfig` declares its own `AuthHooks` interface solely to bridge billing's limit checks into auth's org hooks
- `StripePlanConfig` re-declares what the Better Auth Stripe plugin already defines
- A new app in the monorepo would need to replicate all this wiring

## Goal

Merge billing's core logic (plans, limits, DB queries) into `@workspace/auth` so that:

1. `createAuth` internally enforces workspace/member limits — no hook injection needed
2. `init.ts` becomes simpler — fewer config fields, no ordering dependency
3. New apps get limit enforcement for free by using `@workspace/auth`
4. Plan types and helpers are importable from `@workspace/auth` (one fewer package dependency for consumers)

## What Moves Into `@workspace/auth`

### From `packages/billing/src/plans.ts` (entire file)

- `PlanId`, `Plan`, `PlanLimits`, `PlanPricing` types
- `PLANS` array, `FREE_PLAN_ID` constant
- All helpers: `getPlanById`, `getFreePlan`, `getPlanLimitsForPlanId`, `formatPlanPrice`, `getPlanFeatures`, `getHighestTierPlanId`, `getUpgradePlan`, `resolveUserPlanId`

New location: `packages/auth/src/plans.ts`

New sub-path export: `@workspace/auth/plans`

### From `packages/billing/src/billing.server.ts` (limit enforcement functions)

These functions move **into `createAuth`** as private helpers, called directly from org hooks:

- `resolveUserPlanIdFromDb` — queries subscription table for user's plan
- `countOwnedWorkspaces` — counts workspaces where user is owner
- `getWorkspaceOwnerUserId` — resolves workspace owner
- `countWorkspaceMembers` — counts members in workspace
- `checkWorkspaceLimit` — enforces max workspaces (called in `beforeCreateOrganization`)
- `checkMemberLimit` — enforces max members (called in `beforeCreateInvitation`)

These no longer need to be exported. They become internal implementation details of auth's org hooks.

### From `packages/billing/src/billing.server.ts` (exported utilities)

These stay exported from `@workspace/auth` because the app layer needs them:

- `getInvoicesForUser` — Stripe API call, used by `billing.functions.ts`
- `resolveSubscriptionDetails` — pure function, used by `getBillingData`

New location: `packages/auth/src/billing.server.ts`

New sub-path export: `@workspace/auth/billing`

## What Stays in `apps/web`

The app-level billing files stay put — they use `auth.api` and return UI-facing data:

- `apps/web/src/billing/billing.server.ts` — `getUserActivePlanId`, `getUserPlanContext`, `getBillingData`, `checkUserPlanLimit`, `createCheckoutForPlan`, `createUserBillingPortal`, `reactivateUserSubscription`
- `apps/web/src/billing/billing.functions.ts` — server function wrappers
- `apps/web/src/components/billing/` — UI components

These change their imports from `@workspace/billing` to `@workspace/auth/plans` and `@workspace/auth/billing`.

## New `AuthConfig` (simplified)

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
  logger?: (
    level: 'debug' | 'info' | 'warn' | 'error',
    message: string,
    meta?: Record<string, unknown>
  ) => void;
  getRequestHeaders?: () => Headers;
}
```

**Removed:**

- `stripe.plans` — `createAuth` imports `PLANS` directly from `./plans.ts` and builds the Stripe plugin config internally
- `AuthHooks` — limit enforcement is now internal to `createAuth`
- `StripePlanConfig` — derived internally from `PLANS`, no longer part of the public API

**`packages/auth/src/index.ts` barrel update:** Remove `AuthHooks` and `StripePlanConfig` from the re-exports since they no longer exist as public types.

## New `init.ts` (simplified)

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

**Removed:**

- `billingService` export — no longer needed at app level (limit checks are internal to auth)
- `PLANS` import and `stripePlans` mapping — auth handles this internally
- `hooks` config — billing enforcement is built-in

**Note:** `billingService` is still used by `apps/web/src/billing/billing.server.ts` for `countOwnedWorkspaces`, `countWorkspaceMembers`, `getWorkspaceOwnerUserId`, and `getInvoicesForUser`. These will be exposed from `createAuth`'s return value as `auth.billing.getInvoicesForUser(...)` etc., or as standalone exports from `@workspace/auth/billing`.

## How `createAuth` Changes Internally

### Stripe plan config is built from PLANS

```typescript
// Inside createAuth()
import { PLANS } from './plans';

const stripePlans = PLANS.filter((p) => p.pricing !== null).map((p) => ({
  name: p.id,
  priceId: process.env[`STRIPE_${p.id.toUpperCase()}_MONTHLY_PRICE_ID`]!,
  annualDiscountPriceId:
    process.env[`STRIPE_${p.id.toUpperCase()}_ANNUAL_PRICE_ID`]!,
}));
```

Wait — this means `createAuth` reads `process.env` directly for Stripe price IDs. That's acceptable because:

- These env vars are always required when Stripe is configured
- The pattern is deterministic from PLANS (not arbitrary)
- The alternative (passing them in config) is what we're trying to eliminate

If the user prefers not to have `createAuth` read process.env, we can pass `stripePriceEnv: Record<string, string>` in config. But that's just `process.env` with extra steps.

**Decision:** `createAuth` reads `process.env` directly for Stripe price IDs. The pattern is deterministic from PLANS — not arbitrary env var access.

### Limit enforcement moves into org hooks

```typescript
// Inside createAuth(), private helpers using config.db
async function checkWorkspaceLimit(userId: string): Promise<void> {
  const planId = await resolveUserPlanIdFromDb(config.db, userId);
  const limits = getPlanLimitsForPlanId(planId);
  if (limits.maxWorkspaces === -1) return;
  const workspaceCount = await countOwnedWorkspaces(config.db, userId);
  if (workspaceCount >= limits.maxWorkspaces) {
    throw new APIError('FORBIDDEN', {
      message: `Your plan allows a maximum of ${limits.maxWorkspaces} workspace(s). Please upgrade to create more.`,
    });
  }
}

// In org plugin config:
organizationHooks: {
  beforeCreateOrganization: async ({ organization, user }) => {
    if (!isRecord(organization)) return;
    validateWorkspaceFields(organization, 'create');
    if (isPersonalWorkspace(organization)) return;
    // Direct call — no hook indirection.
    await checkWorkspaceLimit(user.id);
  },
  beforeCreateInvitation: async ({ organization }) => {
    await checkMemberLimit(organization.id);
  },
}
```

## `@workspace/auth` Exports After Merge

| Sub-path                     | Exports                                                                                |
| ---------------------------- | -------------------------------------------------------------------------------------- |
| `@workspace/auth`            | Types (`AuthConfig`, `Auth`), workspace types, permissions, auth helpers (client-safe) |
| `@workspace/auth/server`     | `createAuth`                                                                           |
| `@workspace/auth/client`     | `authClient`                                                                           |
| `@workspace/auth/validators` | `getVerifiedSession`, `validateGuestSession`, `validateAdminSession`                   |
| `@workspace/auth/schemas`    | Zod validation schemas                                                                 |
| `@workspace/auth/plans`      | **NEW** — `PLANS`, `PlanId`, `Plan`, `PlanLimits`, all plan helpers                    |
| `@workspace/auth/billing`    | **NEW** — `resolveSubscriptionDetails`, `getInvoicesForUser`, `AuthBilling` type       |

### `packages/auth/package.json` exports field

Add two new sub-path entries:

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

### `BillingService` type replacement

The old `BillingService = ReturnType<typeof createBillingService>` type no longer exists since `createBillingService` is dissolved. The new type is derived from `createAuth`'s return:

```typescript
export type AuthBilling = ReturnType<typeof createAuth>['billing'];
```

This gives consumers a type for the `auth.billing` object without needing to know its internals.

## What Gets Deleted

- `packages/billing/` — entire directory (after moving files)
- `@workspace/billing` references in:
  - `apps/web/package.json` — remove `"@workspace/billing": "workspace:*"` dependency
  - `apps/web/tsconfig.json` — remove `@workspace/billing` and `@workspace/billing/*` path aliases
  - `pnpm-lock.yaml` — regenerated by `pnpm install`
- Note: `pnpm-workspace.yaml` uses `packages/*` glob — no explicit billing reference to remove

## App-Level Billing Functions — What Changes

`apps/web/src/billing/billing.server.ts` currently imports from both `@workspace/billing` and `@/init`. After the merge:

- `billingService` import from `@/init` → replaced by imports from `@workspace/auth/billing`
- `@workspace/billing/plans` → `@workspace/auth/plans`
- `@workspace/billing/server` → `@workspace/auth/billing`

The `billingService.countOwnedWorkspaces`, `billingService.countWorkspaceMembers`, and `billingService.getWorkspaceOwnerUserId` calls in `checkUserPlanLimit` need a replacement. Options:

**Option A:** `createAuth` returns a `billing` object with these methods:

```typescript
const { api, billing } = createAuth(config);
// billing.getInvoicesForUser, billing.countOwnedWorkspaces, etc.
```

**Option B:** Export a standalone `createBillingQueries(db)` from `@workspace/auth/billing` that returns the DB query helpers. The app creates it once:

```typescript
import { createBillingQueries } from '@workspace/auth/billing';
export const billingQueries = createBillingQueries(db);
```

**Recommendation:** Option A — keeps everything behind `createAuth`, one fewer thing to wire.

## Import Changes Summary

| Old import                                                | New import                                              |
| --------------------------------------------------------- | ------------------------------------------------------- |
| `from '@workspace/billing'`                               | `from '@workspace/auth/plans'` (for plan types/helpers) |
| `from '@workspace/billing/plans'`                         | `from '@workspace/auth/plans'`                          |
| `from '@workspace/billing/server'`                        | `from '@workspace/auth/billing'`                        |
| `import { billingService } from '@/init'`                 | `import { auth } from '@/init'` then `auth.billing.*`   |
| `import { PLANS } from '@workspace/billing'`              | `import { PLANS } from '@workspace/auth/plans'`         |
| `import type { StripePlanConfig } from '@workspace/auth'` | Removed (no longer public)                              |
| `import type { AuthHooks } from '@workspace/auth'`        | Removed (no longer exists)                              |

### All consumer files requiring import updates

**`apps/web/src/billing/` (server + functions):**

- `billing.server.ts` — `@workspace/billing/plans`, `@workspace/billing/server`, `billingService` from `@/init`
- `billing.functions.ts` — `@workspace/billing/plans`, `billingService` from `@/init`

**`apps/web/src/components/billing/` (UI components):**

- `billing-plan-cards.tsx` — `@workspace/billing/plans` (formatPlanPrice, getPlanFeatures, Plan, PlanId)
- `billing-page.tsx` — `@workspace/billing/plans` (getUpgradePlan, PlanId)
- `upgrade-prompt-dialog.tsx` — `@workspace/billing/plans` (formatPlanPrice, getPlanFeatures, Plan)

**`apps/web/src/hooks/`:**

- `use-upgrade-prompt.ts` — `@workspace/billing/plans` (Plan, PlanId)
- `use-upgrade-prompt.test.ts` — `@workspace/billing/plans` (Plan)

**`apps/web/src/init.ts`:**

- Remove `@workspace/billing` and `@workspace/billing/server` imports entirely
- Remove `StripePlanConfig` type import from `@workspace/auth`

**`packages/auth/src/index.ts`:**

- Remove `AuthHooks` and `StripePlanConfig` from re-exports
- Add re-exports from `./plans` for client-safe plan types if needed

## Test Changes

- `packages/billing/src/plans.test.ts` → `packages/auth/src/plans.test.ts` (move, update imports)
- `packages/billing/src/billing.server.test.ts` → `packages/auth/src/billing.server.test.ts` (move, update imports)
- `apps/web/src/billing/billing.server.test.ts` — **mock restructure required**, not just import updates. Currently mocks `billingService` from `@/init`; must change to mock `auth.billing.*` instead (e.g., `auth: { api: {...}, billing: { countOwnedWorkspaces: mock, ... } }`)
- `apps/web/src/billing/billing.functions.ts` — update imports only
- Any test mocking `@workspace/billing/*` needs to mock `@workspace/auth/plans` or `@workspace/auth/billing` instead

## Dependency Changes

### `packages/auth/package.json`

Add (from billing's deps, if not already present):

- `stripe` is already a dependency ✓
- `drizzle-orm` is already a dependency ✓
- `better-auth` is already a dependency ✓

No new dependencies needed.

### `apps/web/package.json`

Remove:

- `"@workspace/billing": "workspace:*"`

### `apps/web/tsconfig.json`

Remove:

- `"@workspace/billing": [...]`
- `"@workspace/billing/*": [...]`

Add (if not present):

- `"@workspace/auth/plans": ["../../packages/auth/src/plans.ts"]`
- `"@workspace/auth/billing": ["../../packages/auth/src/billing.server.ts"]`

## Risk Assessment

**Low risk:**

- Plans, types, and pure helpers are just file moves + import updates
- Tests move with their code
- No behavioral changes

**Medium risk:**

- `createAuth` reading `process.env` for Stripe price IDs is a new pattern — needs documentation
- App-level `billingService` usage needs a clean replacement (Option A vs B)
- The `init.ts` export of `billingService` is used in `billing.functions.ts` — need to verify all consumers switch cleanly

## Decisions Made

1. **Stripe price env vars**: `createAuth` reads `process.env` directly for Stripe price IDs. Pattern is deterministic from PLANS.
2. **`auth.billing` shape**: `createAuth` returns `auth.billing.*` with billing query methods (Option A). One object, no extra wiring.
