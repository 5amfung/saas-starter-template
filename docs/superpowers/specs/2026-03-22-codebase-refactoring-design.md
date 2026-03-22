# Codebase Refactoring Design

**Date:** 2026-03-22
**Goal:** Simplify code, reduce duplication, improve type safety, and fix data bugs across the monorepo.
**Approach:** Bottom-up extraction — build shared primitives first, then update consumers layer by layer.
**Scope exclusion:** `data-table.tsx` (shadcn scaffold) is left as-is.

---

## Layer 1: Shared Table Utilities

### New Files

**`apps/web/src/lib/table-constants.ts`** — shared table constants

- `ACTIONS_COLUMN_CLASS = 'text-right w-14'` (currently duplicated in 4 files)
- `DEFAULT_PAGE_SIZE_OPTIONS = ['10', '25', '50']` (used by workspace tables)
- `ADMIN_PAGE_SIZE_OPTIONS = ['10', '50', '100']` (used by admin table — different values, must stay separate)
- `MAX_SKELETON_ROWS = 10` (currently in 3 files)

**`apps/web/src/components/sortable-header.tsx`** — reusable sort header component

- Signature: `{ column: { getIsSorted: () => false | 'asc' | 'desc' }, label: string }`
- Renders `IconArrowUp`, `IconArrowDown`, or `IconArrowsSort` based on sort state
- Extracted from `workspace-members-table.tsx` (lines 375-395)
- Consumers: `workspace-members-table.tsx`, `workspace-invitations-table.tsx`, `admin-user-table.tsx`

**`apps/web/src/components/table-pagination.tsx`** — reusable pagination controls

- Props: `table` (TanStack Table instance), `totalCount`, `pageSizeOptions`, `isLoading`
- Renders rows-per-page select + first/prev/next/last navigation buttons
- Extracted from the 3 non-scaffold table components (skip `data-table.tsx`)
- Consumers: `workspace-members-table.tsx`, `workspace-invitations-table.tsx`, `admin-user-table.tsx`

**`apps/web/src/lib/format.ts`** — shared formatting utilities

- `formatDate(date: Date | string): string` — en-US locale, short month, numeric day/year
  - Currently duplicated in `workspace-invitations-table.tsx` and `admin-user-table.tsx`
- `normalizeRole(role: string): string` — splits on comma, trims, rejoins
  - Currently duplicated in `workspace-members-table.tsx` and `workspace-invitations-table.tsx`
- `toBase64Url(input: string): string` — browser-only base64url encoding
  - Moved from `change-email-dialog.tsx` with dead Node.js `Buffer` branch removed

**`apps/web/src/hooks/use-column-sort.ts`** — sort cycling hook

- `useColumnSort(sorting, onSortingChange)` returns `handleHeaderSort(columnId)` callback
- Encapsulates 3-state cycle: none → asc → desc → none
- Currently duplicated in `workspace-members-table.tsx`, `workspace-invitations-table.tsx`, `admin-user-table.tsx`

### Files Modified

| File                              | Change                                                                                                                                      |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `workspace-members-table.tsx`     | Remove inline `SortableHeader`, `normalizeRole`, `handleHeaderSort`, pagination block, constants. Import from shared modules.               |
| `workspace-invitations-table.tsx` | Remove inline `SortableHeader`, `normalizeRole`, `formatDate`, `handleHeaderSort`, pagination block, constants. Import from shared modules. |
| `admin-user-table.tsx`            | Remove inline `SortableHeader`, `formatDate`, `handleHeaderSort`, pagination block, constants. Import from shared modules.                  |

---

## Layer 2: Shared Chart Utilities

### New File

**`apps/web/src/components/admin/chart-utils.tsx`**

- `TimeRangeToggle` component — renders ToggleGroup (desktop) + Select (mobile) for `'90d' | '30d' | '7d'` options
  - Currently duplicated in `admin-mau-chart.tsx` (lines 132-179) and `admin-signup-chart.tsx` (lines 153-200)
- `formatDateTick(date: string): string` — X-axis tick label formatting
- `formatDateLabel(date: string): string` — tooltip label formatting

### Files Modified

| File                     | Change                                                                                               |
| ------------------------ | ---------------------------------------------------------------------------------------------------- |
| `admin-mau-chart.tsx`    | Remove inline `TimeRangeToggle`, `formatDateTick`, `formatDateLabel`. Import from `chart-utils.tsx`. |
| `admin-signup-chart.tsx` | Remove inline `TimeRangeToggle`, `formatDateTick`, `formatDateLabel`. Import from `chart-utils.tsx`. |

---

## Layer 3: Form Pattern Consolidation

### New Files

**`apps/web/src/components/form/validated-field.tsx`** — field wrapper

- Encapsulates `isInvalid = field.state.meta.isBlurred && !field.state.meta.isValid`
- Renders `<Field>` with `data-invalid`, children (via render prop receiving field), and `<FieldError>` when invalid
- Eliminates ~5 lines of boilerplate per field instance (~20+ instances across 7+ forms)

**`apps/web/src/components/form/form-submit-button.tsx`** — submit button wrapper

- Props: `form`, `label` (button text), optional `disabled`
- Subscribes to `isSubmitting`, shows `IconLoader2` spinner, renders `<Button type="submit">`
- Consumers: `signin-form.tsx`, `signup-form.tsx`, `forgot-password-form.tsx`, `reset-password-form.tsx`, account forms

**`apps/web/src/components/form/form-error-display.tsx`** — form-level error wrapper

- Props: `form`
- Subscribes to `state.errors`, extracts string errors via `.flatMap((e) => (typeof e === 'string' ? [e] : [])).filter(Boolean)`
- Renders `<FormError>` component
- Consumers: `signin-form.tsx`, `signup-form.tsx`, `reset-password-form.tsx`

### Icon Consistency

Standardize on `IconLoader2` across all forms:

| File                       | Change                                  |
| -------------------------- | --------------------------------------- |
| `signin-form.tsx`          | Replace `IconLoader` with `IconLoader2` |
| `signup-form.tsx`          | Replace `IconLoader` with `IconLoader2` |
| `forgot-password-form.tsx` | Replace `IconLoader` with `IconLoader2` |
| `reset-password-form.tsx`  | Replace `IconLoader` with `IconLoader2` |

---

## Layer 4: Test Infrastructure Cleanup

### New Files

**`apps/web/test/mocks/server-fn.ts`** — shared `createServerFn` mock

- Exports `createServerFnMock()` factory returning the mock module object
- Replaces ~30 lines in each of 4 `*.functions.test.ts` files with:
  ```ts
  import { createServerFnMock } from '../../mocks/server-fn';
  vi.mock('@tanstack/react-start', () => createServerFnMock());
  ```
- Files: `admin.functions.test.ts`, `billing.functions.test.ts`, `workspace.functions.test.ts`, `notification-preferences.functions.test.ts`

**`apps/web/test/mocks/middleware.ts`** — shared `createMiddleware` mock

- Exports mock factory + `capturedServerFns` accumulator pattern
- Consumers: `middleware/auth.test.ts`, `middleware/admin.test.ts`

**`apps/web/test/mocks/google-sign-in-button.ts`** — shared `GoogleSignInButton` mock

- Exports mock factory for `@/components/auth/google-sign-in-button`
- Consumers: 4 auth test files (signin/signup unit + integration)

### Updated Files

**`apps/web/test/mocks/router.ts`** — add `Link` mock

- Add `createRouterLinkMock()` export alongside existing `navigate`/`redirect` mocks
- 11 test files replace their inline `Link` mock with this import

### Deleted Files

- `apps/web/test/unit/workspace/workspace-members.types.test.ts` — duplicate test file (3 tests already covered by `workspace-members-types.test.ts`)

### Consistency

- Remove explicit `import { describe, expect, it, vi } from 'vitest'` from ~8 older test files (after verifying `globals: true` in vitest config)

---

## Layer 5: Surgical Fixes

### Bug Fix — Feature/Limit Mismatch

**`packages/auth/src/plans.ts`**

Derive feature strings from limit constants:

| Plan    | Current Feature String        | Actual Limit                 | Fix                                                                    |
| ------- | ----------------------------- | ---------------------------- | ---------------------------------------------------------------------- |
| Starter | `'10 member'`                 | `maxMembersPerWorkspace: 5`  | `` `${STARTER_LIMITS.maxMembersPerWorkspace} members per workspace` `` |
| Pro     | `'100 members per workspace'` | `maxMembersPerWorkspace: 25` | `` `${PRO_LIMITS.maxMembersPerWorkspace} members per workspace` ``     |
| Pro     | `'10 workspaces'`             | `maxWorkspaces: 25`          | `` `${PRO_LIMITS.maxWorkspaces} workspaces` ``                         |

Apply same derivation pattern for all feature strings that reference limit constants.

### Type Safety Fixes

| File                       | Line | Issue                                | Fix                                                                 |
| -------------------------- | ---- | ------------------------------------ | ------------------------------------------------------------------- |
| `admin/user/index.tsx`     | 102  | `filter as FilterTab`                | Type state as `useState<FilterTab>('all')`                          |
| `linked-accounts-card.tsx` | 96   | `providerId as Parameters<...>`      | Type `Provider.id` as SDK's provider union                          |
| `active-sessions-list.tsx` | 123  | `sessions as Array<SessionItem>`     | Derive `SessionItem` from SDK return type                           |
| `admin.server.ts`          | 143  | `r.lastSignInAt!` non-null assertion | Use truthiness guard: `const t = r.lastSignInAt; return !!t && ...` |

### Dead Code Removal

| File                      | What                                          | Why                                                                |
| ------------------------- | --------------------------------------------- | ------------------------------------------------------------------ |
| `change-email-dialog.tsx` | Node.js `Buffer.from` branch in `toBase64Url` | Unreachable in client component; function moves to `lib/format.ts` |
| `permissions.ts`          | `CUSTOM_PERMISSION_STATEMENTS = {} as const`  | Empty constant with no consumers                                   |

### Package Cleanup

| File                                              | Change                                                                                                                       |
| ------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `auth.server.ts` (lines 182-271)                  | Extract `buildSubscriptionLogPayload(subscription)` helper. Remove 5x `await Promise.resolve()` no-ops.                      |
| `workspace-types.ts` + `auth-workspace.server.ts` | Deduplicate `isRecord` — export from `workspace-types.ts` only, import in `auth-workspace.server.ts`.                        |
| `auth-emails.server.ts`                           | Extract `const getRequestContext = () => buildEmailRequestContext(getRequestHeaders?.())` closure inside `createAuthEmails`. |
| `patch-auth-schema.ts`                            | Replace `findMatchingBrace` + `findMatchingBracket` with single `findMatchingDelimiter(str, pos, openChar, closeChar)`.      |

### Email Template DRY

**`packages/email/src/templates/email-shell.tsx`** (new)

- Props: `preview`, `appName`, `children`, optional `requestContext`
- Renders shared outer shell: `<Html>` → `<Tailwind>` → `<Body>` → `<Container>` → `<Section>` → optional `<EmailSecurityNotice>` → footer
- Consumers: `change-email-approval-email.tsx`, `email-verification-email.tsx`, `reset-password-email.tsx`
- Each template reduces to just its unique content (heading, body copy, CTA button)

---

## Verification Strategy

After each layer:

1. Run `pnpm run typecheck` — ensure no type errors introduced
2. Run `pnpm test` — ensure all unit/integration tests pass
3. Run `pnpm run lint` — ensure no lint violations

After all layers:

4. Run `pnpm run build` — ensure production build succeeds
5. Visual spot-check of affected pages (tables, charts, forms, emails)

---

## Layer 6: Query Key Standardization

Standardize all query keys to hierarchical segments (`['domain', 'resource', ...params]`) and extract to named constants.

### Convention

- Format: `['domain', 'resource', ...dynamicParams]`
- Domain segments: `'session'`, `'account'`, `'workspace'`, `'admin'`, `'billing'`
- Resource segments use kebab-case: `'active-list'`, `'last-login-method'`, `'notification-preferences'`
- Constants named `<DOMAIN>_<RESOURCE>_QUERY_KEY` in SCREAMING_SNAKE_CASE

### New File

**`apps/web/src/lib/query-keys.ts`** — centralized query key constants

All query keys extracted here as named constants, organized by domain:

```ts
// Session
export const SESSION_QUERY_KEY = ['session', 'current'] as const;
export const SESSIONS_QUERY_KEY = ['session', 'active-list'] as const;

// Account
export const LINKED_ACCOUNTS_QUERY_KEY = [
  'account',
  'linked-accounts',
] as const;
export const LAST_LOGIN_METHOD_QUERY_KEY = [
  'account',
  'last-login-method',
] as const;
export const NOTIFICATION_PREFERENCES_QUERY_KEY = [
  'account',
  'notification-preferences',
] as const;

// Workspace (factory functions for dynamic params)
export const workspaceKeys = {
  members: (workspaceId: string, ...params: unknown[]) =>
    ['workspace', 'members', workspaceId, ...params] as const,
  invitations: (workspaceId: string) =>
    ['workspace', 'invitations', workspaceId] as const,
  activeRole: (workspaceId: string) =>
    ['workspace', 'active-role', workspaceId] as const,
};

// Admin (factory functions for dynamic params)
export const adminKeys = {
  dashboardMetrics: (timezoneOffset: number) =>
    ['admin', 'dashboard-metrics', timezoneOffset] as const,
  signupChart: (range: string, timezoneOffset: number) =>
    ['admin', 'signup-chart', range, timezoneOffset] as const,
  mauChart: (range: string, timezoneOffset: number) =>
    ['admin', 'mau-chart', range, timezoneOffset] as const,
  users: (...params: unknown[]) => ['admin', 'users', ...params] as const,
  user: (userId: string) => ['admin', 'user', userId] as const,
};

// Billing
export const INVOICES_QUERY_KEY = ['billing', 'invoices'] as const;
export const BILLING_DATA_QUERY_KEY = ['billing', 'data'] as const;
```

### Files Modified

| File                                            | Change                                                                                    |
| ----------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `hooks/use-session-query.ts`                    | Remove local `SESSION_QUERY_KEY`, import from `query-keys.ts`                             |
| `hooks/use-sessions-query.ts`                   | Remove local `SESSIONS_QUERY_KEY`, import from `query-keys.ts`                            |
| `hooks/use-linked-accounts-query.ts`            | Remove local `LINKED_ACCOUNTS_QUERY_KEY`, import from `query-keys.ts`                     |
| `components/account/active-sessions-list.tsx`   | Replace inline `['last-login-method']` with `LAST_LOGIN_METHOD_QUERY_KEY`                 |
| `routes/_protected/_account/notifications.tsx`  | Replace inline `['account', 'notification-preferences']` with constant                    |
| `workspace/use-invitations-table.ts`            | Replace inline keys with `workspaceKeys.invitations(...)`                                 |
| `workspace/use-members-table.ts`                | Replace inline keys with `workspaceKeys.members(...)` and `workspaceKeys.activeRole(...)` |
| `routes/_protected/admin/dashboard.tsx`         | Replace inline keys with `adminKeys.*` factories                                          |
| `routes/_protected/admin/user/index.tsx`        | Replace inline key with `adminKeys.users(...)`                                            |
| `routes/_protected/admin/user/$userId.tsx`      | Replace inline key with `adminKeys.user(...)`                                             |
| `components/admin/admin-delete-user-dialog.tsx` | Replace inline `['admin', 'users']` with `adminKeys.users()`                              |
| `components/admin/admin-user-form.tsx`          | Replace inline invalidation keys with `adminKeys.users()` and `adminKeys.user(...)`       |
| `components/billing/billing-page.tsx`           | Remove local constants, import from `query-keys.ts`                                       |

### Key value changes (old → new)

| Old Value                  | New Value                          | Reason                                                            |
| -------------------------- | ---------------------------------- | ----------------------------------------------------------------- |
| `['current_session']`      | `['session', 'current']`           | Hierarchical + enables prefix invalidation of all session queries |
| `['user_active_sessions']` | `['session', 'active-list']`       | Consistent domain prefix                                          |
| `['linked_accounts']`      | `['account', 'linked-accounts']`   | Consistent domain prefix                                          |
| `['last-login-method']`    | `['account', 'last-login-method']` | Add domain prefix                                                 |

Note: Changing query key values means any cached data under the old keys will be invalidated on the next deploy. This is a one-time cache miss with no functional impact.

---

## Verification Strategy

After each layer:

1. Run `pnpm run typecheck` — ensure no type errors introduced
2. Run `pnpm test` — ensure all unit/integration tests pass
3. Run `pnpm run lint` — ensure no lint violations

After all layers:

4. Run `pnpm run build` — ensure production build succeeds
5. Visual spot-check of affected pages (tables, charts, forms, emails)

---

## Out of Scope

- `data-table.tsx` — shadcn scaffold, left as-is
- `packages/ui/src/components/sidebar.tsx` / `chart.tsx` — shadcn-generated, per project conventions
- `querySignupChartData` / `queryMauChartData` SQL optimization — performance improvement, not a refactoring concern
