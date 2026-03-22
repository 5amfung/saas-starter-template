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

**Strategy:** Mock `createMiddleware` to capture the server callback and invoke it directly:

```ts
let capturedServerFn: (opts: { next: () => Promise<void> }) => Promise<void>;

vi.mock('@tanstack/react-start', () => ({
  createMiddleware: () => ({
    server: (fn: typeof capturedServerFn) => {
      capturedServerFn = fn;
      return { handler: fn };
    },
  }),
}));

vi.mock('@tanstack/react-start/server', () => ({
  getRequestHeaders: vi.fn(() => new Headers({ cookie: 'test' })),
}));
```

Then test by calling `capturedServerFn({ next: mockNext })` and asserting `next()` was called (or that the error propagated). The existing `@/init` mock from the helper tests must also be carried over.

**Note:** The helper functions (`validateAuthSession`, etc.) are already thoroughly tested. These wrapper tests cover only the thin `createMiddleware` → `getRequestHeaders` → delegate → `next()` glue. If this proves overly complex during implementation, the wrapper lines (3-4 per middleware) may be excluded from coverage scope since all business logic is tested via the helpers.

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
- `link_error` URL param: set `window.location.search = '?link_error=1&error=email_mismatch'` via `Object.defineProperty` before rendering → assert `toast.error` called with the mapped error message → assert `window.history.replaceState` was called to clean up the params.
- Connect error: mock `authClient.linkSocial` to return error → assert `toast.error` fires.

### 3. Workspace + Data Table (apps/web)

#### 3a. `workspace-invite-dialog.tsx` (56% → target 85%+)

**File:** `src/components/workspace/workspace-invite-dialog.tsx`
**Existing test:** `test/unit/components/workspace/workspace-invite-dialog.test.tsx`

**New test cases** (submit and pending-state tests already exist):

- Role select: render with `open={true}` → change role via Select → assert `onRoleChange` called with valid role.
- Role select guard: fire `onValueChange` with value not in `roles` → assert `onRoleChange` NOT called.

#### 3b. `data-table.tsx` (71% → target 80%+)

**File:** `src/components/data-table.tsx`
**Existing test:** `test/unit/components/data-table.test.tsx`

**New test cases:**

- Pagination: render with enough rows → click "Next page" → assert page changes.
- Pagination: click "Last page", "Previous page", "First page" buttons.
- Pagination disabled states: on page 1, "Previous" and "First" are disabled; on last page, "Next" and "Last" are disabled.
- Rows-per-page: change Select value → assert `table.setPageSize` called.
- Mobile vs desktop: mock `useIsMobile` to `false` → click a row's header button to open the `TableCellViewer` Drawer → assert chart container renders inside the drawer. Mock Recharts to avoid SVG complexity.
- Mock `useIsMobile` to `true` → open the same drawer → assert chart container is absent.

### 4. New Test Files (apps/web)

#### 4a. `chart-area-interactive.tsx` (0% → target 80%+)

**File:** `src/components/chart-area-interactive.tsx`
**New test file:** `test/unit/components/chart-area-interactive.test.tsx`

**Test cases:**

Mock Recharts to intercept the `data` prop passed to `AreaChart` (avoids SVG assertion complexity). The component uses a hardcoded `referenceDate` of `2024-06-30`, so filtering is deterministic.

- Renders chart container with default 90d range — intercept `AreaChart` data prop and assert full dataset length.
- Time range select: change to `'30d'` → assert `AreaChart` receives ~30 data points.
- Time range select: change to `'7d'` → assert `AreaChart` receives ~7 data points.
- Mobile default: mock `useIsMobile` → `true` → assert Select value is `'7d'` after initial render.

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
- `buildPersonalWorkspaceSlug('abc')` → `'personal-abc'` (already lowercase passthrough)

#### 5b. `billing.server.ts` (81% → target 90%+)

**File:** `packages/auth/src/billing.server.ts`
**Existing test:** `packages/auth/test/unit/billing.server.test.ts`

**New test cases:**

- `getInvoicesForUser` when user has `stripeCustomerId`: mock `stripeClient.invoices.list` → assert return shape with mapped fields (the success path at lines 81-90).

Note: `resolveSubscriptionDetails` with `cancelAtPeriodEnd: null` → `false` is already tested in the existing test file (line 97-108).

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

Email package is already at 100%/97%/100%/100% — no new tests needed, just adding the threshold config to lock in the current level.

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
