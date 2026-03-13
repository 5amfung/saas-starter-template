# Test Coverage Expansion Design

## Goal

Add comprehensive tests to the SaaS starter template to ensure developer confidence across business-critical paths and UI components. The approach is risk-driven: highest-blast-radius code is tested first, shared test infrastructure is built alongside, and coverage expands in phases.

## Current State

- **15 test files** covering ~53% of modules.
- **Strong coverage:** Zod schemas, billing logic, workspace utilities, core utilities.
- **Gaps:** Middleware (0%), hooks (0%), UI components (0%), several server function wrappers, admin analytics, notification preferences, email sending.
- **Testing Library + jsdom are installed** but unused (no component tests exist).
- **No shared test utilities** — each test file handles its own mock setup.

## Approach

**Risk-driven, three-phase rollout:**

1. **Phase 1 — Foundation + Critical Paths:** Shared test infra, middleware, auth form components.
2. **Phase 2 — Core UI + Server Logic:** Workspace/account/admin components, admin analytics, notification preferences, email sending.
3. **Phase 3 — Expansion:** Custom hooks, email templates, edge cases across all modules.

> **Note on `*.functions.ts` wrappers:** Server function files like `billing.functions.ts`, `admin.functions.ts`, and `notification-preferences.functions.ts` are thin delegation wrappers (call `requireVerifiedSession()`, forward to `*.server.ts` logic). Testing these would only verify that `createServerFn` calls the function you passed it — which is the framework's responsibility. These are intentionally excluded from the test plan. The underlying business logic in `*.server.ts` files is where tests belong.

---

## Phase 1: Foundation + Critical Paths

### 1.1 Shared Test Infrastructure

#### New Files

| File                       | Purpose                                                                                                                                                       |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/test/render.tsx`      | Custom `renderWithProviders()` — wraps components in `QueryClientProvider` (fresh client per test), TanStack Router `MemoryRouter` context                    |
| `src/test/factories.ts`    | Mock data factories: `createMockUser()`, `createMockSession()`, `createMockWorkspace()`, `createMockSubscription()` with sensible defaults + override merging |
| `src/test/mocks/auth.ts`   | Reusable `authClient` mocks — `signIn.email`, `signUp.email`, `getSession`, `organization.*`                                                                  |
| `src/test/mocks/db.ts`     | Shared `mockDbChain()` helper (extracted from billing tests) + common Drizzle mock patterns                                                                   |
| `src/test/mocks/router.ts` | Mocked `useNavigate`, `useRouter`, `redirect` from TanStack Router                                                                                            |

#### Config Changes

**`vitest.config.ts`** — Add `environmentMatchGlobs` to use `jsdom` for `*.test.tsx` files while keeping `node` for `*.server.test.ts` and `*.test.ts`:

```ts
test: {
  globals: true,
  setupFiles: ['vitest.setup.ts'],
  include: ['src/**/*.test.{ts,tsx}'],
  environmentMatchGlobs: [
    ['src/**/*.test.tsx', 'jsdom'],
    ['src/hooks/**/*.test.ts', 'jsdom'],
  ],
}
```

**`vitest.setup.ts`** — Add any global setup needed (e.g., jsdom cleanup, global mocks).

#### Design Decisions

- **Factories use override merging:** `createMockUser({ name: 'Test' })` returns a full mock user with only `name` overridden. This keeps tests declarative — you only specify what matters for each test case.
- **Fresh QueryClient per render:** Prevents cache leakage between tests. Created inside `renderWithProviders()`.
- **Extract `mockDbChain()` from billing tests:** The chainable `db.select().from().where()` mock pattern is reused in 4+ test files. Centralizing it reduces boilerplate and ensures consistency.

### 1.2 Middleware Tests

**Testing approach:** TanStack Start middleware is created via `createMiddleware().server(handler)`. The handler is an opaque callback — there's no public API to invoke it directly in tests. To make the middleware logic testable:

1. **Extract the core logic** from each middleware into standalone async functions (e.g., `validateAuthSession(headers)`, `validateAdminSession(headers)`) in the same file.
2. The `createMiddleware().server()` calls become thin wrappers that call the extracted functions.
3. Tests target the extracted functions directly — no need to mock `createMiddleware` internals.

This refactor is minimal (moving ~5 lines per middleware into a named function) and follows the existing pattern of extracting testable logic from framework wrappers.

#### `src/middleware/auth.test.ts`

Tests for extracted `validateAuthSession()`:

| Test case                                 | Expected behavior                                   |
| ----------------------------------------- | --------------------------------------------------- |
| No session (getSession returns null)      | Throws redirect to `/signin`                        |
| Session exists, `emailVerified: false`    | Throws redirect to `/signin`                        |
| Valid session, `emailVerified: true`      | Calls `ensureActiveWorkspaceForSession()`, proceeds |
| Valid session, workspace resolution fails | Appropriate error propagation                       |

Tests for extracted `validateGuestSession()`:

| Test case            | Expected behavior        |
| -------------------- | ------------------------ |
| No session           | Returns without throwing |
| Valid session exists | Throws redirect to `/ws` |

#### `src/middleware/admin.test.ts`

Tests for extracted `validateAdminSession()`:

| Test case                                            | Expected behavior            |
| ---------------------------------------------------- | ---------------------------- |
| No session                                           | Throws redirect to `/signin` |
| Session with `emailVerified: false`                  | Throws redirect to `/signin` |
| Session with non-admin role                          | Throws redirect to `/signin` |
| Session with `role: 'admin'` + `emailVerified: true` | Proceeds                     |

**Mock strategy:** Hoist mocks for `auth.api.getSession()`, `redirect()`, and `ensureActiveWorkspaceForSession()`. Same hoisted pattern as existing billing tests. No need to mock `createMiddleware` since tests target the extracted functions.

### 1.3 Auth Form Components

#### Unit Tests

**`src/components/auth/login-form.test.tsx`:**

| Test case                                             | What it verifies                                       |
| ----------------------------------------------------- | ------------------------------------------------------ |
| Renders email and password fields                     | Component mounts correctly with expected form elements |
| Shows validation errors on empty submit               | Zod schema validation surfaces through TanStack Form   |
| Shows error message on 401 response                   | Server error mapped to form-level error display        |
| Calls `authClient.signIn.email()` with correct params | Form data forwarded correctly to auth client           |
| Navigates to `/ws` on success                         | `useNavigate` called with correct destination          |

**`src/components/auth/signup-form.test.tsx`:**

| Test case                                             | What it verifies                         |
| ----------------------------------------------------- | ---------------------------------------- |
| Renders name, email, and password fields              | Component mounts correctly               |
| Validates password requirements (min length)          | Schema validation surfaces errors        |
| Shows 422 field errors from server                    | Per-field server errors mapped correctly |
| Calls `authClient.signUp.email()` with correct params | Form data forwarded correctly            |
| Navigates on success                                  | Post-signup navigation works             |

#### Integration Tests

**`src/components/auth/login-form.integration.test.tsx`:**

| Test case                                              | What it verifies                            |
| ------------------------------------------------------ | ------------------------------------------- |
| Full sign-in flow: fill → submit → success → navigate  | End-to-end happy path through the component |
| Error recovery: bad credentials → fix → retry succeeds | User can recover from auth errors           |

**`src/components/auth/signup-form.integration.test.tsx`:**

| Test case                                             | What it verifies      |
| ----------------------------------------------------- | --------------------- |
| Full sign-up flow: fill → submit → success → navigate | End-to-end happy path |

**Mock strategy:**

- Mock `authClient` methods — not the real auth server.
- Mock `useNavigate` to verify navigation calls.
- Use `renderWithProviders()` from shared test infra.
- Use `@testing-library/react` `userEvent` for realistic form interactions (type, click, blur triggers validation).

---

## Phase 2: Core UI + Server Logic

### 2.1 Workspace UI Components (unit tests)

| Component               | Test file                                                   | Key test cases                                                                                      |
| ----------------------- | ----------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Members table           | `src/components/workspace/members-table.test.tsx`           | Renders member list; role badges display correctly; invite/remove actions trigger correct callbacks |
| Workspace settings form | `src/components/workspace/workspace-settings-form.test.tsx` | Renders current name/slug; validates input; calls update function on submit                         |
| Workspace switcher      | `src/components/workspace/workspace-switcher.test.tsx`      | Lists workspaces; shows active workspace; triggers switch on selection                              |

### 2.2 Account UI Components (unit tests)

| Component              | Test file                                          | Key test cases                                                                                                    |
| ---------------------- | -------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Account settings forms | `src/components/account/account-settings.test.tsx` | Profile update renders and submits; password change validates matching passwords; notification preferences toggle |

### 2.3 Admin UI Components (unit tests)

| Component             | Test file                                             | Key test cases                                                           |
| --------------------- | ----------------------------------------------------- | ------------------------------------------------------------------------ |
| Dashboard metrics     | `src/components/admin/dashboard-metrics.test.tsx`     | Renders metric cards with correct values; handles empty/loading states   |
| User management table | `src/components/admin/user-management-table.test.tsx` | Renders user list; role change triggers callback; ban/unban actions work |

### 2.4 Server Logic Tests

| Module                             | Test file                                                | Key test cases                                                                                                                                                                                                                                                                                                                                                   |
| ---------------------------------- | -------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Admin analytics server logic       | `src/admin/admin.server.test.ts` (extend existing)       | Add tests for `queryDashboardMetrics`, `querySignupChartData`, `queryMauChartData` — mock DB queries, verify timezone-aware bucketing, test empty result sets |
| Notification preferences server    | `src/account/notification-preferences.server.test.ts`    | `getNotificationPreferencesForUser` returns preferences with defaults; `upsertNotificationPreferencesForUser` creates/updates correctly; handles missing user |
| Notification preferences schema    | `src/account/notification-preferences.schemas.test.ts`   | Valid input passes; invalid fields rejected                                                                                                                                                                                                                                                                                                                      |
| Email sending                      | `src/email/resend.server.test.ts`                        | Sends email via Resend SDK; handles API errors; validates required env vars (RESEND_API_KEY, RESEND_FROM_EMAIL); prefixes subject in non-production. **Note:** Module uses a singleton `resendClient` and reads env vars at module load time. Tests must use `vi.resetModules()` between tests that need different env states to avoid cross-test contamination. |

---

## Phase 3: Expansion

### 3.1 Custom Hook Tests

| Hook                     | Test file                                     | Key test cases                                                                                                                                                                                                                                                                       |
| ------------------------ | --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `useSessionQuery`        | `src/hooks/use-session-query.test.ts`         | Returns session data on success; returns null when no session; handles auth error; correct query key                                                                                                                                                                                 |
| `useUpgradePrompt`       | `src/hooks/use-upgrade-prompt.test.ts`        | `show()` populates dialog props (title, description, plan); `onOpenChange(false)` closes dialog; `onUpgrade()` fires mutation with correct planId + annual; `onUpgrade()` is no-op when `upgradePlan` is null; sets `window.location.href` on checkout success; shows toast on error |
| `useLinkedAccountsQuery` | `src/hooks/use-linked-accounts-query.test.ts` | Fetches linked OAuth accounts; handles empty list                                                                                                                                                                                                                                    |
| `useSessionsQuery`       | `src/hooks/use-sessions-query.test.ts`        | Fetches active sessions; handles error state                                                                                                                                                                                                                                         |

**Strategy:** Use `renderHook` from `@testing-library/react` with a QueryClient wrapper. Mock `authClient` methods. No DOM rendering needed.

### 3.2 Email Template Tests

**`src/components/email-template/email-templates.test.tsx`:**

| Test case                                    | What it verifies                                    |
| -------------------------------------------- | --------------------------------------------------- |
| Each template renders without errors         | No runtime crashes with required props              |
| Required props produce expected text content | Key content (user name, links, action text) appears |
| Missing optional props don't crash           | Graceful handling of optional data                  |

**Strategy:** Mock React Email components as simple string values (consistent with `auth-emails.server.test.ts` pattern). Verify that templates are invoked with correct props via `createElement()` calls. This avoids depending on the React Email rendering pipeline (CSS inlining, etc.) which is slow and occasionally flaky. Full rendering fidelity is covered by `pnpm run email:dev` visual preview.

### 3.3 Edge Cases (additions to existing tests)

| Area       | Cases to add                                                             |
| ---------- | ------------------------------------------------------------------------ |
| Middleware | Malformed session objects; expired sessions; missing headers             |
| Billing    | Stripe API failures; concurrent plan changes; exactly at max plan limits |
| Workspace  | Switching to deleted workspace; removing last admin member               |
| Auth forms | Network failures during submit; rapid double-submit prevention           |

---

## File Summary

| Phase     | New test files | New infra files | Updates to existing                                          |
| --------- | -------------- | --------------- | ------------------------------------------------------------ |
| Phase 1   | ~6             | 5               | 3 (vitest config, billing test extract, middleware refactor) |
| Phase 2   | ~9             | 0               | 0                                                            |
| Phase 3   | ~5             | 0               | ~4 (edge case additions)                                     |
| **Total** | **~20**        | **5**           | **~7**                                                       |

## Testing Patterns

All new tests follow the established codebase patterns:

- **Mock hoisting:** `vi.hoisted()` + `vi.mock()` for module mocks.
- **Chainable DB mocks:** Shared `mockDbChain()` helper for Drizzle ORM patterns.
- **Cleanup:** `beforeEach(() => vi.clearAllMocks())` in every test file.
- **Parametrized tests:** `it.each()` for testing multiple similar cases.
- **Component tests:** `renderWithProviders()` + `userEvent` for realistic interactions.
- **Hook tests:** `renderHook()` with QueryClient wrapper.

## Success Criteria

- All new tests pass with `pnpm test`.
- No regressions in existing tests.
- Phase 1 covers all auth/billing critical paths.
- Component tests validate user-facing behavior, not implementation details.
- Shared test utilities reduce boilerplate for future test authoring.
