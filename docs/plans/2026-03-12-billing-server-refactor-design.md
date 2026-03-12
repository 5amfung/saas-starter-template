# Billing Server Refactor — Extract Logic from Functions to Server

**Date:** 2026-03-12
**Status:** Approved

## Problem

`billing.functions.ts` contains all business logic inline in server function handlers. This makes the logic untestable — `createServerFn` handlers require the full TanStack Start request lifecycle. The rest of the codebase follows the convention where `*.functions.ts` is a thin wrapper and `*.server.ts` holds the testable logic.

## Design

### File responsibilities

**`billing.functions.ts`** — Thin wrappers only:

- `createServerFn()` + Zod input validation
- Call `requireVerifiedSession()` / `getRequestHeaders()`
- Pass `headers`/`session` to `billing.server.ts` functions
- Return result

**`billing.server.ts`** — All business logic:

- Existing context-free functions unchanged (`resolveUserPlanIdFromDb`, `countOwnedWorkspaces`, `countWorkspaceMembers`, `getWorkspaceOwnerUserId`, `getUserSubscriptionDetails`)
- `getUserActivePlanId` gains `headers` parameter instead of calling `getRequestHeaders()` internally
- 6 new extracted functions receive `headers` and/or `userId` as parameters
- `stripeClient` instantiation moves here (server-only concern)

**No changes to:** `auth.server.ts` hooks (they call context-free functions directly), `plans.ts`.

### Request context boundary

- **Functions called from auth hooks** (`resolveUserPlanIdFromDb`, `countOwnedWorkspaces`, `countWorkspaceMembers`): No `headers` parameter — hooks run outside HTTP request context.
- **Functions called from server function handlers**: Accept `headers` as a parameter. `getRequestHeaders()` is only called in the thin wrappers.

### New helper: `getUserPlanContext`

Consolidates the repeated "resolve plan + get plan object + get upgrade info" pattern that appears 3 times:

```ts
interface UserPlanContext {
  planId: PlanId;
  plan: Plan;
  planName: string;
  limits: PlanLimits;
  upgradePlan: Plan | null;
}

async function getUserPlanContext(
  headers: Headers,
  userId: string,
): Promise<UserPlanContext>;
```

Used by: `getBillingData`, `checkPlanLimit` (both current-user and owner branches).

### Signature change: `getUserActivePlanId`

```ts
// Before:
async function getUserActivePlanId(userId: string): Promise<PlanId>;
// calls getRequestHeaders() internally

// After:
async function getUserActivePlanId(
  headers: Headers,
  userId: string,
): Promise<PlanId>;
// headers passed by caller
```

### Extracted function signatures

| Function                     | Signature                                                                                    | Notes                                                            |
| ---------------------------- | -------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| `getInvoicesForUser`         | `(userId: string)`                                                                           | Uses `stripeClient` directly, needs `stripeCustomerId` lookup    |
| `createCheckoutForPlan`      | `(headers: Headers, planId: PlanId, annual: boolean)`                                        | Calls `auth.api.upgradeSubscription`                             |
| `createBillingPortal`        | `(headers: Headers)`                                                                         | Calls `auth.api.createBillingPortal`                             |
| `getBillingData`             | `(headers: Headers, userId: string)`                                                         | Uses `getUserPlanContext` + `getUserSubscriptionDetails`         |
| `reactivateUserSubscription` | `(headers: Headers, userId: string)`                                                         | Calls `auth.api.listActiveSubscriptions` + `restoreSubscription` |
| `checkPlanLimit`             | `(headers: Headers, userId: string, feature: 'workspace' \| 'member', workspaceId?: string)` | Uses `getUserPlanContext`, branching for workspace vs member     |

### Thin wrapper pattern

Each wrapper in `billing.functions.ts` becomes roughly:

```ts
export const getInvoices = createServerFn().handler(async () => {
  const session = await requireVerifiedSession();
  return getInvoicesForUser(session.user.id);
});
```

### Testing strategy

**Test file:** `src/billing/billing.server.test.ts`

**Testable functions:** `getUserPlanContext`, `checkPlanLimit`, `getBillingData`, `reactivateUserSubscription`, `getInvoicesForUser`, `createCheckoutForPlan`, `createBillingPortal`.

**Mocking approach:** Mock `auth.api` methods and `db` queries. Functions receive `headers` as a parameter, so no need to mock `getRequestHeaders()`.

**Not tested:** The thin wrappers in `billing.functions.ts` (integration test territory).
