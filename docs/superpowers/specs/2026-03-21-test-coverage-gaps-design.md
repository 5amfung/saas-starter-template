# Test Coverage Gaps — Design Spec

**Date:** 2026-03-21
**Branch:** `chk-test-cov`
**Approach:** Bottom-up sweep across all packages, thresholds added at the end.

## Context

Coverage analysis revealed an overall **83.4% statement / 73.7% branch** coverage for the web app, with specific files significantly below average. The auth package sits at **91.5%** with targeted gaps. Admin components are excluded from this pass (potential throwaway code).

## Scope

### 1. Middleware Wrappers (apps/web)

**Files:** `src/middleware/auth.ts` (50% lines), `src/middleware/admin.ts` (40% lines)

**Gap:** The `validateX` helper functions are well-tested. The `createMiddleware()` wrappers (`authMiddleware`, `guestMiddleware`, `adminMiddleware`) that call `getRequestHeaders()` and delegate are untested (lines 25-35 in auth.ts, lines 11-15 in admin.ts).

**Test cases:**

- `authMiddleware`: mock `getRequestHeaders` → mock `validateAuthSession` success → assert `next()` called.
- `authMiddleware`: mock `getRequestHeaders` → mock `validateAuthSession` rejection → assert error propagates.
- `guestMiddleware`: mock `getRequestHeaders` → mock `validateGuestSession` success → assert `next()` called.
- `guestMiddleware`: mock `getRequestHeaders` → mock `validateGuestSession` rejection → assert error propagates.
- `adminMiddleware`: mock `getRequestHeaders` → mock `validateAdminSession` success → assert `next()` called.
- `adminMiddleware`: mock `getRequestHeaders` → mock `validateAdminSession` rejection → assert error propagates.

**Mocks needed:** `@tanstack/react-start` (`createMiddleware`), `@tanstack/react-start/server` (`getRequestHeaders`).

**Strategy:** Since `createMiddleware` returns a builder object, we need to either:

- (a) Mock it to capture the server callback and invoke it directly, or
- (b) Test at the integration level by calling the middleware's handler.

Option (a) is cleaner — mock `createMiddleware` to return a spy that captures the server function, then invoke the captured function with a mock `next`.

### 2. Account Components (apps/web)

#### 2a. `active-sessions-list.tsx` (53% → target 80%+)

**File:** `src/components/account/active-sessions-list.tsx`
**Existing test:** `test/unit/components/account/active-sessions-list.test.tsx`

**New test cases:**

- Revoke session mutation error: mock `authClient.revokeSession` to reject → assert `toast.error` called with error message.
- Error state retry: render with `useSessionsQuery` in error state → click "Retry" button → assert `refetch()` called.
- AlertDialog confirm: render with non-current session → click "Revoke" → in AlertDialog, click confirm → assert `revokeSessionMutation.mutate` called with correct token.
- AlertDialog cancel: open dialog → close via `onOpenChange(false)` → assert `selectedSession` resets to null.

#### 2b. `linked-accounts-card.tsx` (58% → target 80%+)

**File:** `src/components/account/linked-accounts-card.tsx`
**Existing test:** `test/unit/components/account/linked-accounts-card.test.tsx`

**New test cases:**

- Disconnect success: render with linked Google account → click "Disconnect" → confirm in dialog → assert `authClient.unlinkAccount` called, `toast.success` fires, queries invalidated.
- Disconnect error: mock `authClient.unlinkAccount` to reject → assert `toast.error` fires.
- Disconnect dialog cancel: open dialog → close without confirming → assert state resets.
- `link_error` URL param: render with `link_error` search param → assert `toast.error` called with mapped message.
- Connect error: mock `authClient.linkSocial` to return error → assert `toast.error` fires.

### 3. Workspace + Data Table (apps/web)

#### 3a. `workspace-invite-dialog.tsx` (56% → target 85%+)

**File:** `src/components/workspace/workspace-invite-dialog.tsx`
**Existing test:** `test/unit/components/workspace/workspace-invite-dialog.test.tsx`

**New test cases:**

- Role select: render with `open={true}` → change role via Select → assert `onRoleChange` called with valid role.
- Role select guard: fire `onValueChange` with value not in `roles` → assert `onRoleChange` NOT called.
- Submit: click "Send Invitation" → assert `onSubmit` called.
- Pending state: render with `isPending={true}` → assert spinner visible and buttons disabled.

#### 3b. `data-table.tsx` (71% → target 80%+)

**File:** `src/components/data-table.tsx`
**Existing test:** `test/unit/components/data-table.test.tsx`

**New test cases:**

- Pagination: render with enough rows → click "Next page" → assert page changes.
- Pagination: click "Last page", "Previous page", "First page" buttons.
- Pagination disabled states: on page 1, "Previous" and "First" are disabled; on last page, "Next" and "Last" are disabled.
- Rows-per-page: change Select value → assert `table.setPageSize` called.
- Mobile vs desktop: mock `useIsMobile` to `false` → open `TableCellViewer` drawer → assert chart block renders.
- Mock `useIsMobile` to `true` → assert chart block absent.

### 4. New Test Files (apps/web)

#### 4a. `chart-area-interactive.tsx` (0% → target 80%+)

**File:** `src/components/chart-area-interactive.tsx`
**New test file:** `test/unit/components/chart-area-interactive.test.tsx`

**Test cases:**

- Renders chart container with default 90d range.
- Time range select: change to `'30d'` → assert filtered data reflects ~30 day window.
- Time range select: change to `'7d'` → assert filtered data reflects ~7 day window.
- Mobile default: mock `useIsMobile` → `true` → assert range defaults to `'7d'`.

#### 4b. `section-cards.tsx` (0% → target 100%)

**File:** `src/components/section-cards.tsx`
**New test file:** `test/unit/components/section-cards.test.tsx`

**Test cases:**

- Renders all four card titles: "Total Revenue", "New Customers", "Active Accounts", "Growth Rate".

### 5. Auth Package Gaps (packages/auth)

#### 5a. `workspace-types.ts` (50% → target 100%)

**File:** `packages/auth/src/workspace-types.ts`
**New test file:** `packages/auth/test/unit/workspace-types.test.ts`

**Test cases (pure functions, no mocks):**

- `isPersonalWorkspace(null)` → `false`
- `isPersonalWorkspace({})` → `false`
- `isPersonalWorkspace({ workspaceType: 'workspace' })` → `false`
- `isPersonalWorkspace({ workspaceType: 'personal' })` → `true`
- `isPersonalWorkspaceOwnedByUser(null, 'u1')` → `false`
- `isPersonalWorkspaceOwnedByUser({ workspaceType: 'personal', personalOwnerUserId: 'u1' }, 'u1')` → `true`
- `isPersonalWorkspaceOwnedByUser({ workspaceType: 'personal', personalOwnerUserId: 'u2' }, 'u1')` → `false`
- `buildPersonalWorkspaceSlug('ABC')` → `'personal-abc'`

#### 5b. `billing.server.ts` (81% → target 90%+)

**File:** `packages/auth/src/billing.server.ts`
**Existing test:** `packages/auth/test/unit/billing.server.test.ts`

**New test cases:**

- `getInvoicesForUser` when user has `stripeCustomerId`: mock `stripeClient.invoices.list` → assert return shape with mapped fields.
- `resolveSubscriptionDetails` edge cases: `cancelAtPeriodEnd: null` defaults to `false`.

### 6. Coverage Thresholds

After all tests pass, add `thresholds` to each vitest config:

```ts
// Example for apps/web
coverage: {
  // ... existing config
  thresholds: {
    lines: 85,
    branches: 75,
    functions: 80,
    statements: 85,
  },
},
```

Threshold values will be set based on the actual achieved coverage with a 2-3% buffer below the final numbers. This prevents accidental regressions while allowing minor fluctuation.

| Package        | Target Lines | Target Branches | Target Functions |
| -------------- | ------------ | --------------- | ---------------- |
| apps/web       | 85%          | 75%             | 80%              |
| packages/auth  | 90%          | 88%             | 88%              |
| packages/email | 95%          | 95%             | 100%             |

## Testing Patterns

All tests follow existing project conventions:

- `vi.hoisted()` for mock declarations.
- `vi.mock()` for module-level mocks.
- `@workspace/test-utils` for shared factories (`createMockSessionResponse`, etc.).
- `@testing-library/react` for component rendering.
- `vitest` globals (`describe`, `it`, `expect`, `vi`).
- Test file mirrors source structure under `test/unit/` or `test/integration/`.

## Out of Scope

- **Admin components** (`admin-signup-chart`, `admin-mau-chart`, `admin-dashboard-cards`, `admin-user-form`, `admin-user-table`) — potential throwaway code.
- **Route files** (`src/routes/**`) — best covered by integration/e2e tests, excluded from coverage scope.
- **Auto-generated files** (`routeTree.gen.ts`, `auth.schema.ts`).
- **shadcn/ui components** — vendored third-party code.
- **`packages/db`** — schema-only package, no runtime logic to unit test.

## Implementation Order

1. Auth package: `workspace-types.ts` (pure, no deps — quick win)
2. Auth package: `billing.server.ts` (mock Stripe)
3. Web middleware: `auth.ts`, `admin.ts` wrappers
4. Web account: `active-sessions-list`, `linked-accounts-card`
5. Web workspace: `workspace-invite-dialog`
6. Web data-table: pagination and interaction paths
7. New files: `chart-area-interactive`, `section-cards`
8. Coverage thresholds: add to all vitest configs
9. Final verification: run full coverage suite, confirm thresholds pass
