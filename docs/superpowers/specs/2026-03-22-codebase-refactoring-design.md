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

- Props: `table` (TanStack Table instance), `totalCount`, `pageSizeOptions`, `isLoading`, `responsiveBreakpoint` (`'md' | 'lg'`, default `'md'`)
- `responsiveBreakpoint` controls the breakpoint at which first/last page buttons and total count are shown (workspace tables use `md:`, admin table uses `lg:`)
- Renders rows-per-page select + first/prev/next/last navigation buttons
- Extracted from the 3 non-scaffold table components (skip `data-table.tsx`)
- Consumers: `workspace-members-table.tsx`, `workspace-invitations-table.tsx` (default `'md'`), `admin-user-table.tsx` (`'lg'`)

**`apps/web/src/lib/format.ts`** — shared formatting utilities

- `formatDate(date: Date | string): string` — en-US locale, short month, numeric day/year
  - Currently duplicated in `workspace-invitations-table.tsx` and `admin-user-table.tsx`
- `normalizeRole(role: string): string` — splits on comma, trims, rejoins
  - Currently duplicated in `workspace-members-table.tsx` and `workspace-invitations-table.tsx`
- `toBase64Url(input: string): string` — browser-only base64url encoding
  - Moved from `change-email-dialog.tsx` with dead Node.js `Buffer` branch removed

**`apps/web/src/hooks/use-column-sort.ts`** — sort cycling hook

- `useColumnSort(sorting, onSortingChange)` returns memoized `handleHeaderSort(columnId)` callback
- Uses `useCallback` internally with `[sorting, onSortingChange]` deps to match current memoization behavior
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
- `formatDateLabel(value: React.ReactNode): string` — Recharts tooltip `labelFormatter`; coerces `ReactNode` via `String(value)` before formatting

### Files Modified

| File                     | Change                                                                                               |
| ------------------------ | ---------------------------------------------------------------------------------------------------- |
| `admin-mau-chart.tsx`    | Remove inline `TimeRangeToggle`, `formatDateTick`, `formatDateLabel`. Import from `chart-utils.tsx`. |
| `admin-signup-chart.tsx` | Remove inline `TimeRangeToggle`, `formatDateTick`, `formatDateLabel`. Import from `chart-utils.tsx`. |

---

## Layer 3: Form Pattern Consolidation

### New Files

**`apps/web/src/components/form/validated-field.tsx`** — field wrapper

- Thin wrapper around the shadcn `<Field>` component (NOT TanStack Form's `form.Field` subscriber)
- Each form still calls `form.Field` directly with its own `name`, `validators`, and generics
- This component receives the subscribed field state and handles only the validation display concern:
  - Computes `isInvalid = field.state.meta.isBlurred && !field.state.meta.isValid`
  - Sets `data-invalid` on the wrapper
  - Renders `<FieldError>` when invalid
- Usage example:
  ```tsx
  <form.Field name="email" validators={{ onChange: schema.shape.email }}>
    {(field) => (
      <ValidatedField field={field} label="Email">
        <Input
          value={field.state.value}
          onChange={(e) => field.handleChange(e.target.value)}
        />
      </ValidatedField>
    )}
  </form.Field>
  ```
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

- Remove explicit `import { describe, expect, it, vi } from 'vitest'` from all test files with redundant imports (after verifying `globals: true` in vitest config)

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

| File                                                                                             | Change                                                                                                                                                                                                                                                                   |
| ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `auth.server.ts`                                                                                 | Extract `buildSubscriptionLogPayload(subscription)` helper returning common fields; each handler adds event-specific fields (`cancellationDetails`, etc.). Remove all `await Promise.resolve()` no-ops (7 occurrences across subscription hooks and organization hooks). |
| `workspace-types.ts` + `auth-workspace.server.ts` + `apps/web/src/workspace/workspace.server.ts` | Deduplicate `isRecord` — export from `workspace-types.ts` only, import in both `auth-workspace.server.ts` and `workspace.server.ts`.                                                                                                                                     |
| `auth-emails.server.ts`                                                                          | Extract `const getRequestContext = () => buildEmailRequestContext(getRequestHeaders?.())` closure inside `createAuthEmails`.                                                                                                                                             |
| `patch-auth-schema.ts`                                                                           | Replace `findMatchingBrace` + `findMatchingBracket` with single `findMatchingDelimiter(str, pos, openChar, closeChar)`.                                                                                                                                                  |

### Email Template DRY

**`packages/email/src/templates/email-shell.tsx`** (new)

- Props: `preview`, `appName`, `children`, optional `requestContext`
- Renders shared outer shell: `<Html>` → `<Tailwind>` → `<Body>` → `<Container>` → `<Section>` → optional `<EmailSecurityNotice>` → footer
- Consumers: `change-email-approval-email.tsx`, `email-verification-email.tsx`, `reset-password-email.tsx`, `workspace-invitation-email.tsx`
- `EmailSecurityNotice` renders only when `requestContext` is provided — `workspace-invitation-email.tsx` passes no `requestContext`, so it correctly omits the security notice
- Each template reduces to just its unique content (heading, body copy, CTA button)

---

## Layer 6: Query Key Value Standardization

Rename the 4 non-hierarchical query keys to use the hierarchical `['domain', 'resource']` format. Constants stay defined in their current files — no centralization or extraction of inline keys.

### Files Modified

| File                                          | Change                                                                                                  |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `hooks/use-session-query.ts`                  | Update `SESSION_QUERY_KEY` value from `['current_session']` to `['session', 'current']`                 |
| `hooks/use-sessions-query.ts`                 | Update `SESSIONS_QUERY_KEY` value from `['user_active_sessions']` to `['session', 'active-list']`       |
| `hooks/use-linked-accounts-query.ts`          | Update `LINKED_ACCOUNTS_QUERY_KEY` value from `['linked_accounts']` to `['account', 'linked-accounts']` |
| `components/account/active-sessions-list.tsx` | Update inline `['last-login-method']` to `['account', 'last-login-method']`                             |

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

## Implementation Notes

- **No barrel files.** New shared modules are imported directly by path. The existing codebase does not use barrel files consistently, and adding them risks breaking tree-shaking.
- **`data-table.tsx` retains its own `ACTIONS_COLUMN_CLASS` copy.** Since the scaffold is explicitly out of scope, its inline constant stays even though the shared version exists in `lib/table-constants.ts`.
- **Consumers importing renamed query key constants automatically pick up the new values.** Only the 4 files where the constants are defined need changes; all import sites get the new keys transitively.
- **Existing tests for consumer components may need mock/import path updates** after shared modules are extracted. The per-layer verification strategy (typecheck + test + lint) will surface these; fix them as part of each layer.

---

## Out of Scope

- `data-table.tsx` — shadcn scaffold, left as-is
- `packages/ui/src/components/sidebar.tsx` / `chart.tsx` — shadcn-generated, per project conventions
- `querySignupChartData` / `queryMauChartData` SQL optimization — performance improvement, not a refactoring concern
