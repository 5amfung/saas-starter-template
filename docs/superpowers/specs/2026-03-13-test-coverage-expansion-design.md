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

1. **Phase 1 — Foundation + Critical Paths:** Shared test infra, middleware, billing functions, auth form components.
2. **Phase 2 — Core UI + Server Logic:** Workspace/account/admin components, admin analytics, notification preferences, email sending.
3. **Phase 3 — Expansion:** Custom hooks, email templates, edge cases across all modules.

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
  ],
}
```

**`vitest.setup.ts`** — Add any global setup needed (e.g., jsdom cleanup, global mocks).

#### Design Decisions

- **Factories use override merging:** `createMockUser({ name: 'Test' })` returns a full mock user with only `name` overridden. This keeps tests declarative — you only specify what matters for each test case.
- **Fresh QueryClient per render:** Prevents cache leakage between tests. Created inside `renderWithProviders()`.
- **Extract `mockDbChain()` from billing tests:** The chainable `db.select().from().where()` mock pattern is reused in 4+ test files. Centralizing it reduces boilerplate and ensures consistency.

### 1.2 Middleware Tests

#### `src/middleware/auth.test.ts`

Tests for `authMiddleware`:

| Test case                                 | Expected behavior                                   |
| ----------------------------------------- | --------------------------------------------------- |
| No session (getSession returns null)      | Throws redirect to `/signin`                        |
| Session exists, `emailVerified: false`    | Throws redirect to `/signin`                        |
| Valid session, `emailVerified: true`      | Calls `ensureActiveWorkspaceForSession()`, proceeds |
| Valid session, workspace resolution fails | Appropriate error propagation                       |

Tests for `guestMiddleware`:

| Test case            | Expected behavior        |
| -------------------- | ------------------------ |
| No session           | Proceeds (guest allowed) |
| Valid session exists | Throws redirect to `/ws` |

#### `src/middleware/admin.test.ts`

Tests for `adminMiddleware`:

| Test case                                            | Expected behavior            |
| ---------------------------------------------------- | ---------------------------- |
| No session                                           | Throws redirect to `/signin` |
| Session with `emailVerified: false`                  | Throws redirect to `/signin` |
| Session with non-admin role                          | Throws redirect to `/signin` |
| Session with `role: 'admin'` + `emailVerified: true` | Proceeds                     |

**Mock strategy:** Hoist mocks for `auth.api.getSession()`, `redirect()`, and `ensureActiveWorkspaceForSession()`. Same hoisted pattern as existing billing tests.

### 1.3 Billing Server Function Tests

#### `src/billing/billing.functions.test.ts`

These test the `createServerFn` wrappers — the integration seam between route loaders and the already-tested server logic.

| Function                     | Key test cases                                                                                 |
| ---------------------------- | ---------------------------------------------------------------------------------------------- |
| `getInvoices`                | Validates auth; calls server logic with correct params; returns formatted invoice list         |
| `createCheckoutSession`      | Validates plan param; checks eligibility; returns Stripe checkout URL; handles ineligible plan |
| `createBillingPortalSession` | Validates workspace ownership; returns portal URL; rejects non-owners                          |
| `checkPlanLimit`             | Checks workspace against plan limits; returns allowed/denied with reason                       |
| `getBillingData`             | Aggregates subscription + plan info; handles no active subscription                            |

**Mock strategy:** Mock the `*.server.ts` imports (already-tested functions) and `getRequestHeaders`. Verify correct delegation, parameter forwarding, and error propagation. Do NOT re-test the underlying logic.

### 1.4 Auth Form Components

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

| Module                             | Test file                                                | Key test cases                                                                                                                      |
| ---------------------------------- | -------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Admin analytics functions          | `src/admin/admin.functions.test.ts`                      | `getAdminDashboardMetrics` returns formatted metrics; `getSignupChartData` validates date range; `getMauChartData` handles timezone |
| Notification preferences functions | `src/account/notification-preferences.functions.test.ts` | Get returns user preferences; upsert creates/updates correctly; validates input                                                     |
| Notification preferences schema    | `src/account/notification-preferences.schemas.test.ts`   | Valid input passes; invalid fields rejected                                                                                         |
| Email sending                      | `src/email/resend.server.test.ts`                        | Sends email via Resend SDK; handles API errors; validates required fields                                                           |

---

## Phase 3: Expansion

### 3.1 Custom Hook Tests

| Hook                     | Test file                                     | Key test cases                                                                                       |
| ------------------------ | --------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `useSessionQuery`        | `src/hooks/use-session-query.test.ts`         | Returns session data on success; returns null when no session; handles auth error; correct query key |
| `useUpgradePrompt`       | `src/hooks/use-upgrade-prompt.test.ts`        | Shows prompt at plan limit; dismisses correctly; hidden on highest tier                              |
| `useLinkedAccountsQuery` | `src/hooks/use-linked-accounts-query.test.ts` | Fetches linked OAuth accounts; handles empty list                                                    |
| `useSessionsQuery`       | `src/hooks/use-sessions-query.test.ts`        | Fetches active sessions; handles error state                                                         |

**Strategy:** Use `renderHook` from `@testing-library/react` with a QueryClient wrapper. Mock `authClient` methods. No DOM rendering needed.

### 3.2 Email Template Tests

**`src/components/email-template/email-templates.test.tsx`:**

| Test case                                    | What it verifies                                    |
| -------------------------------------------- | --------------------------------------------------- |
| Each template renders without errors         | No runtime crashes with required props              |
| Required props produce expected text content | Key content (user name, links, action text) appears |
| Missing optional props don't crash           | Graceful handling of optional data                  |

**Strategy:** Render React Email components to static HTML using `render()` from `@react-email/render`. Assert key content strings appear in output.

### 3.3 Edge Cases (additions to existing tests)

| Area       | Cases to add                                                             |
| ---------- | ------------------------------------------------------------------------ |
| Middleware | Malformed session objects; expired sessions; missing headers             |
| Billing    | Stripe API failures; concurrent plan changes; exactly at max plan limits |
| Workspace  | Switching to deleted workspace; removing last admin member               |
| Auth forms | Network failures during submit; rapid double-submit prevention           |

---

## File Summary

| Phase     | New test files | New infra files | Updates to existing                     |
| --------- | -------------- | --------------- | --------------------------------------- |
| Phase 1   | ~7             | 5               | 2 (vitest config, billing test extract) |
| Phase 2   | ~9             | 0               | 0                                       |
| Phase 3   | ~5             | 0               | ~4 (edge case additions)                |
| **Total** | **~21**        | **5**           | **~6**                                  |

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
