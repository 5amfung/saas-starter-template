# Integration Tests Design Spec

## Overview

Add comprehensive unit and integration tests to the SaaS starter template, targeting three priority areas: auth/access control, billing correctness, and UI regression safety. Tests stay in Vitest (no Playwright/E2E for now) and use mocked DB/auth (no real database).

## Motivation

The project has solid coverage for middleware (100%), hooks (100%), schemas (100%), and several component groups (admin, account, workspace). However, critical gaps exist in:

- **Auth/access control** — Workspace server helpers, auth validators, and server function wrappers that gate route access are untested.
- **Billing** — Server helpers like `getUserActivePlanId` and `getBillingData` lack tests. All 5 billing UI components are untested.
- **Password reset flow** — 3 auth components (forgot, reset, check email) plus small helpers (FormError, GoogleSignInButton, AuthLayout) are untested.
- **Layout/navigation** — 11 components including WorkspaceSwitcher, AppSidebar, SiteHeader, and nav components are untested.

## Approach

**Risk-prioritized (Approach B):** Group tests by business risk rather than architectural layer. Each phase delivers a complete vertical of coverage for a domain, addressing the most dangerous gaps first.

## Conventions

Consistent with the existing codebase:

- **File naming:** `*.test.tsx` for components, `*.test.ts` for server logic.
- **Directory:** Mirror `src/` structure under `test/unit/`.
- **Mocking:** Use `vi.hoisted()` + `vi.mock()` pattern already established.
- **Rendering:** Use `renderWithProviders` from `@workspace/test-utils` for components with React Query.
- **Factories:** Use existing `createMockUser`, `createMockSession`, `createMockWorkspace` from `@workspace/test-utils`.
- **Assertions:** `@testing-library/jest-dom` matchers, `userEvent` for interactions.
- **DB mocking:** Use existing `mockDbChain`/`mockDbInsertChain` helpers from `test/mocks/db.ts`.

---

## Phase 1: Auth & Workspace Access Control

**Priority:** Highest — security. These functions decide who can access what.

### 1.1 Auth Validators

**Source:** `packages/auth/src/validators.ts`
**Test file:** `packages/auth/test/unit/validators.test.ts` (new)

Functions accept `auth` as a parameter, so no module mocking needed — pass a mock auth object directly.

Note: `getVerifiedSession` and `validateAdminSession` use the same `!session || !session.user.emailVerified` guard — the "no session" and "unverified email" cases exercise the same branch but with distinct inputs.

| Test                                   | Function               | What it verifies       |
| -------------------------------------- | ---------------------- | ---------------------- |
| Returns session for verified user      | `getVerifiedSession`   | Happy path             |
| Redirects to `/signin` when no session | `getVerifiedSession`   | Null session input     |
| Redirects when email not verified      | `getVerifiedSession`   | Unverified email input |
| Redirects to `/ws` when authenticated  | `validateGuestSession` | Guest guard            |
| Does nothing for unauthenticated user  | `validateGuestSession` | Guest pass-through     |
| Returns session for admin              | `validateAdminSession` | Happy path             |
| Redirects non-admin user               | `validateAdminSession` | Role check             |
| Redirects unverified admin             | `validateAdminSession` | Verify + role          |

### 1.2 Workspace Server Helpers

**Source:** `apps/web/src/workspace/workspace.server.ts`
**Test file:** `apps/web/test/unit/workspace/workspace.server.test.ts` (extend existing)

Mock `@/init` (auth.api.listOrganizations, auth.api.setActiveOrganization). Do NOT mock `@/workspace/workspace` (`pickDefaultWorkspace`) — use the real implementation, consistent with existing tests.

**Already covered by existing tests:** `ensureActiveWorkspaceForSession` (returns active workspace, falls back to personal, sets active on fallback, throws when no workspaces) and `ensureWorkspaceMembership` (rejects non-member). Only add tests for gaps:

| Test                                      | Function                    | What it verifies    |
| ----------------------------------------- | --------------------------- | ------------------- |
| Returns workspaces from auth API          | `listUserWorkspaces`        | Delegates correctly |
| Returns workspace when user is member     | `ensureWorkspaceMembership` | Happy path          |
| Throws NOT_FOUND for empty workspace list | `ensureWorkspaceMembership` | Edge case           |

### 1.3 Workspace Server Functions

**Source:** `apps/web/src/workspace/workspace.functions.ts`
**Test file:** `apps/web/test/unit/workspace/workspace.functions.test.ts` (new)

Tests `resolveWorkspaceRouteAccess` (gates every `/ws/$workspaceId/*` route) and `getActiveWorkspaceId` (resolves the active workspace for redirect logic). Mock `@/init`, `@tanstack/react-start/server` (getRequestHeaders), and `@/workspace/workspace.server`.

**`resolveWorkspaceRouteAccess` tests:**

| Test                                                  | What it verifies |
| ----------------------------------------------------- | ---------------- |
| Redirects to `/signin` when no session                | Auth gate        |
| Redirects to `/signin` when email not verified        | Verify gate      |
| Returns workspace when user is member                 | Happy path       |
| Switches active workspace when different from current | Side effect      |
| Skips switching when already on correct workspace     | Optimization     |
| Throws NOT_FOUND when user is not a member            | Access denied    |

**`getActiveWorkspaceId` tests:**

| Test                                                              | What it verifies |
| ----------------------------------------------------------------- | ---------------- |
| Redirects to `/signin` when no session                            | Auth gate        |
| Returns `activeOrganizationId` when already set on session        | Fast path        |
| Falls back to `ensureActiveWorkspaceForSession` when no active ID | Fallback path    |
| Returns workspace ID from fallback result                         | Return value     |

### 1.4 Notification Preferences Server Helpers

**Source:** `apps/web/src/account/notification-preferences.server.ts`
**Test file:** `apps/web/test/unit/account/notification-preferences.server.test.ts` (new)

Mock `@/init` (db.select, db.insert, auth.api.getSession) using existing `mockDbChain`/`mockDbInsertChain` helpers. Also mock `@tanstack/react-start/server` (getRequestHeaders) — `requireVerifiedSession` calls `getRequestHeaders()` internally, so the mock must return `new Headers()` before each test.

Note: `emailUpdates` is always returned as `true` from `DEFAULT_NOTIFICATION_PREFERENCES` — it is never read from DB. Only `marketingEmails` is queried and stored. Tests should verify this constant behavior, not assert DB reads for `emailUpdates`.

| Test                                   | Function                               | What it verifies                 |
| -------------------------------------- | -------------------------------------- | -------------------------------- |
| Returns session for verified user      | `requireVerifiedSession`               | Happy path                       |
| Redirects when no session              | `requireVerifiedSession`               | Auth gate                        |
| Returns defaults when no row           | `getNotificationPreferencesForUser`    | Default behavior (both fields)   |
| Returns stored `marketingEmails` value | `getNotificationPreferencesForUser`    | DB read (only `marketingEmails`) |
| Inserts when no existing row           | `upsertNotificationPreferencesForUser` | Create path                      |
| Updates on conflict                    | `upsertNotificationPreferencesForUser` | Update path                      |
| Skips write when patch has no boolean  | `upsertNotificationPreferencesForUser` | No-op guard                      |

---

## Phase 2: Billing

**Priority:** High — money. Billing correctness is critical.

### 2.1 Remaining Billing Server Gaps

**Source:** `apps/web/src/billing/billing.server.ts`
**Test file:** `apps/web/test/unit/billing/billing.server.test.ts` (extend existing)

Mock setup note: `requireVerifiedSession` calls `getRequestHeaders()` internally. The existing test file already mocks `@tanstack/react-start/server` — ensure `getRequestHeaders` returns `new Headers()` before each `requireVerifiedSession` test.

**Already covered by existing tests:** `getUserPlanContext` (5 tests), `checkUserPlanLimit` (multiple scenarios), `createCheckoutForPlan`, `createUserBillingPortal`, `reactivateUserSubscription`, and `getBillingData` (free + pro cases). Only add tests for gaps:

| Test                                                   | Function                 | What it verifies                                                        |
| ------------------------------------------------------ | ------------------------ | ----------------------------------------------------------------------- |
| Returns session for verified user                      | `requireVerifiedSession` | Happy path                                                              |
| Redirects when no session                              | `requireVerifiedSession` | Auth gate                                                               |
| Delegates to resolveUserPlanId with subscription array | `getUserActivePlanId`    | Direct call (currently only tested indirectly via `getUserPlanContext`) |
| Returns free plan when no subscriptions                | `getUserActivePlanId`    | Default when called directly                                            |

### 2.2 Billing Plan Cards

**Source:** `apps/web/src/components/billing/billing-plan-cards.tsx`
**Test file:** `apps/web/test/unit/components/billing/billing-plan-cards.test.tsx` (new)

| Test                                                                 | What it verifies                                                                   |
| -------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| Renders current plan name and features                               | Content display                                                                    |
| Shows "Free forever" for plans without pricing                       | Free tier                                                                          |
| Shows formatted price for current paid plan (always monthly display) | Paid tier — note: current plan uses `formatPlanPrice(plan, false)`, not the toggle |
| Shows formatted price for upgrade plan (respects annual toggle)      | Upgrade pricing                                                                    |
| Shows renewal date when `nextBillingDate` provided                   | Date display                                                                       |
| Hides "Manage subscription" button for free plan                     | Conditional UI                                                                     |
| Shows "Manage subscription" for paid plan                            | Conditional UI                                                                     |
| Shows upgrade card with plan features when `upgradePlan` provided    | Upgrade path                                                                       |
| Shows "Custom plan" card when no upgrade available                   | Top-tier state                                                                     |
| Calls `onManage` when manage button clicked                          | Interaction                                                                        |
| Calls `onUpgrade` with plan ID when upgrade button clicked           | Interaction                                                                        |
| Toggles between monthly/annual billing                               | Interaction                                                                        |
| Disables manage button when `isManaging` is true                     | Loading state                                                                      |
| Disables upgrade button when `isUpgrading` is true                   | Loading state                                                                      |

### 2.3 Upgrade Prompt Dialog

**Source:** `apps/web/src/components/billing/upgrade-prompt-dialog.tsx`
**Test file:** `apps/web/test/unit/components/billing/upgrade-prompt-dialog.test.tsx` (new)

| Test                                                                        | What it verifies |
| --------------------------------------------------------------------------- | ---------------- |
| Renders plan name, price, and features when `upgradePlan` provided          | Content          |
| Shows "Maybe later" cancel button when `upgradePlan` is non-null            | Dismiss path     |
| Shows limit-reached message with "Got it" button when `upgradePlan` is null | No-upgrade state |
| Calls `onUpgrade` when upgrade button clicked                               | Interaction      |
| Disables upgrade button when `isUpgrading` is true                          | Loading state    |
| Shows spinner when upgrading                                                | Loading state    |
| Toggles monthly/annual billing                                              | Interaction      |

### 2.4 Billing Invoice Table

**Source:** `apps/web/src/components/billing/billing-invoice-table.tsx`
**Test file:** `apps/web/test/unit/components/billing/billing-invoice-table.test.tsx` (new)

| Test                                                           | What it verifies |
| -------------------------------------------------------------- | ---------------- |
| Shows loading state when `isLoading` is true                   | Loading          |
| Shows "No invoices for this period" when empty                 | Empty state      |
| Renders invoice rows with date, status badge, amount, and link | Content          |
| Formats amounts correctly (cents to dollars)                   | Formatting       |
| Shows correct status badge variants (paid/open/other)          | Visual state     |
| Shows dash when invoice has no URL                             | Missing link     |
| Filters invoices by selected month                             | Interaction      |

### 2.5 Billing Downgrade Banner

**Source:** `apps/web/src/components/billing/billing-downgrade-banner.tsx`
**Test file:** `apps/web/test/unit/components/billing/billing-downgrade-banner.test.tsx` (new)

| Test                                                    | What it verifies |
| ------------------------------------------------------- | ---------------- |
| Shows downgrade date in formatted text                  | Content          |
| Calls `onReactivate` when button clicked                | Interaction      |
| Disables button and shows spinner when `isReactivating` | Loading state    |

### 2.6 Billing Page

**Source:** `apps/web/src/components/billing/billing-page.tsx`
**Test file:** `apps/web/test/unit/components/billing/billing-page.test.tsx` (new)

Mock server functions from `@/billing/billing.functions` and `sonner` toast.

| Test                                                                           | What it verifies |
| ------------------------------------------------------------------------------ | ---------------- |
| Returns null while billing data is loading                                     | Loading state    |
| Renders plan cards with correct data when loaded                               | Composition      |
| Renders invoice table                                                          | Composition      |
| Shows downgrade banner when subscription is pending cancel                     | Conditional UI   |
| Hides downgrade banner for active subscriptions                                | Conditional UI   |
| Calls upgrade mutation and redirects via `window.location.href` on success     | Interaction      |
| Calls manage mutation and redirects via `window.location.href` on success      | Interaction      |
| Reactivate mutation toasts success and invalidates queries (does NOT redirect) | Interaction      |
| Shows toast on mutation error                                                  | Error handling   |

---

## Phase 3: Password Reset Flow

**Priority:** Medium — user-facing auth flow.

### 3.1 Forgot Password Form

**Source:** `apps/web/src/components/auth/forgot-password-form.tsx`
**Test file:** `apps/web/test/unit/components/auth/forgot-password-form.test.tsx` (new)

Mock `@workspace/auth/client` (authClient.requestPasswordReset) and `@tanstack/react-router` (Link).

| Test                                               | What it verifies  |
| -------------------------------------------------- | ----------------- |
| Renders email input and submit button              | Initial render    |
| Shows validation error on blur with invalid email  | Client validation |
| Calls `authClient.requestPasswordReset` on submit  | Submission        |
| Shows success card with "Check your email" message | Success state     |
| Shows "Back to sign in" link on success card       | Navigation        |
| Shows form error when API returns error            | Error handling    |
| Disables button and shows spinner while submitting | Loading state     |

### 3.2 Reset Password Form

**Source:** `apps/web/src/components/auth/reset-password-form.tsx`
**Test file:** `apps/web/test/unit/components/auth/reset-password-form.test.tsx` (new)

Mock `@workspace/auth/client` (authClient.resetPassword) and `@tanstack/react-router` (Link). Do NOT mock `resetPasswordSchema` from `@workspace/auth/schemas` — use the real schema so password-match validation is tested end-to-end.

| Test                                                          | What it verifies                                   |
| ------------------------------------------------------------- | -------------------------------------------------- |
| Shows "Invalid reset link" when no token provided             | Missing token                                      |
| Shows "Invalid reset link" when error prop set                | Error prop                                         |
| Shows "Request new reset link" on invalid state               | Recovery link                                      |
| Renders password and confirm password fields with valid token | Initial render                                     |
| Shows validation error when passwords don't match             | Client validation (via real `resetPasswordSchema`) |
| Calls `authClient.resetPassword` with token on submit         | Submission                                         |
| Shows "Password updated" success card after success           | Success state                                      |
| Shows form error when API returns error                       | Error handling                                     |
| Disables button and shows spinner while submitting            | Loading state                                      |

### 3.3 Small Auth Components

**Check Email Card** — `apps/web/test/unit/components/auth/check-email-card.test.tsx` (new)

| Test                                               | What it verifies |
| -------------------------------------------------- | ---------------- |
| Renders email domain link when recognized provider | Provider link    |
| Shows generic message for unknown provider         | Fallback         |
| Renders "Back to sign in" link                     | Navigation       |

**Form Error** — `apps/web/test/unit/components/auth/form-error.test.tsx` (new)

| Test                                    | What it verifies |
| --------------------------------------- | ---------------- |
| Renders nothing when errors array empty | Empty state      |
| Renders error messages when provided    | Content          |

**Google Sign-In Button** — `apps/web/test/unit/components/auth/google-sign-in-button.test.tsx` (new)

| Test                                      | What it verifies |
| ----------------------------------------- | ---------------- |
| Renders Google icon and button text       | Content          |
| Calls `authClient.signIn.social` on click | Interaction      |

**Auth Layout** — `apps/web/test/unit/components/auth/auth-layout.test.tsx` (new)

| Test                                | What it verifies |
| ----------------------------------- | ---------------- |
| Renders children within card layout | Composition      |

---

## Phase 4: Layout & Navigation

**Priority:** Lower — UI regression safety.

### 4.1 Workspace Switcher

**Source:** `apps/web/src/components/workspace-switcher.tsx`
**Test file:** `apps/web/test/unit/components/workspace-switcher.test.tsx` (new)

Mock `@workspace/auth/client`, `@/billing/billing.functions` (checkPlanLimit), `@tanstack/react-router` (useNavigate), `@workspace/ui/components/sidebar` (useSidebar), `sonner` (toast).

`checkPlanLimit` is called as a direct async function (not via React Query). The mock must return `Promise<CheckPlanLimitResult>` with shape: `{ allowed: boolean, current: number, limit: number, planName: string, upgradePlan: Plan | null }`.

| Test                                                              | What it verifies  |
| ----------------------------------------------------------------- | ----------------- |
| Renders active workspace name and logo                            | Initial render    |
| Shows all workspaces in dropdown when opened                      | Dropdown content  |
| Calls `authClient.organization.setActive` and navigates on switch | Workspace switch  |
| Shows toast on switch error                                       | Error handling    |
| Opens create dialog when plan limit allows                        | Create flow       |
| Shows upgrade prompt when at workspace limit                      | Limit enforcement |
| Validates workspace name (empty, invalid chars)                   | Client validation |
| Creates workspace, activates it, and navigates on success         | Create success    |
| Shows toast on create error                                       | Error handling    |
| Disables buttons while mutation is pending                        | Loading state     |

### 4.2 Navigation Components

**Nav Main** — `apps/web/test/unit/components/nav-main.test.tsx` (new)

| Test                                            | What it verifies |
| ----------------------------------------------- | ---------------- |
| Renders nav items with correct labels and icons | Content          |
| Renders links with correct hrefs                | Navigation       |
| Highlights active item based on current route   | Active state     |

**Nav Admin** — `apps/web/test/unit/components/nav-admin.test.tsx` (new)

| Test                    | What it verifies |
| ----------------------- | ---------------- |
| Renders admin nav items | Content          |
| Renders correct links   | Navigation       |

**Nav Secondary** — `apps/web/test/unit/components/nav-secondary.test.tsx` (new)

| Test                             | What it verifies |
| -------------------------------- | ---------------- |
| Renders secondary nav items      | Content          |
| Renders links with correct hrefs | Navigation       |

**Nav User** — `apps/web/test/unit/components/nav-user.test.tsx` (new)

| Test                                                 | What it verifies |
| ---------------------------------------------------- | ---------------- |
| Renders user name and email                          | Content          |
| Shows dropdown with account/billing/sign-out options | Dropdown content |
| Calls sign-out on click                              | Interaction      |

### 4.3 Layout Components

**App Sidebar** — `apps/web/test/unit/components/app-sidebar.test.tsx` (new)

| Test                                                   | What it verifies |
| ------------------------------------------------------ | ---------------- |
| Renders workspace switcher, nav sections, and user nav | Composition      |
| Passes correct props to child components               | Prop wiring      |

**Site Header** — `apps/web/test/unit/components/site-header.test.tsx` (new)

| Test                                   | What it verifies |
| -------------------------------------- | ---------------- |
| Renders breadcrumb and sidebar trigger | Content          |

**Dynamic Breadcrumb** — `apps/web/test/unit/components/dynamic-breadcrumb.test.tsx` (new)

| Test                                        | What it verifies |
| ------------------------------------------- | ---------------- |
| Renders breadcrumb items from route matches | Content          |
| Handles single-level and multi-level paths  | Edge cases       |

### 4.4 Simple/Presentational Components

**Not Found** — `apps/web/test/unit/components/not-found.test.tsx` (new)

| Test                              | What it verifies |
| --------------------------------- | ---------------- |
| Renders 404 message and home link | Content          |

**Theme Provider** — `apps/web/test/unit/components/theme-provider.test.tsx` (new)

| Test                               | What it verifies |
| ---------------------------------- | ---------------- |
| Provides theme context to children | Context          |

**Data Table** — `apps/web/test/unit/components/data-table.test.tsx` (new)

| Test                                                   | What it verifies |
| ------------------------------------------------------ | ---------------- |
| Renders table headers and rows from column definitions | Content          |
| Handles empty state                                    | Edge case        |

---

## Summary

| Phase                | New/Extended Test Files | Estimated Tests | Priority              |
| -------------------- | ----------------------- | --------------- | --------------------- |
| 1 — Auth & Workspace | 3 new, 1 extend         | ~26             | Highest — security    |
| 2 — Billing          | 5 new, 1 extend         | ~45             | High — money          |
| 3 — Password Reset   | 6 new                   | ~22             | Medium — user flow    |
| 4 — Layout & Nav     | 11 new                  | ~30             | Lower — UI regression |
| **Total**            | **~25 test files**      | **~123 tests**  |                       |

## Decisions

- **No real database:** All tests use mocked DB via existing `mockDbChain`/`mockDbInsertChain` helpers.
- **No E2E tests:** Staying in Vitest. Playwright E2E can be added later.
- **Risk-prioritized ordering:** Auth/access control first, then billing, then password reset, then layout/nav.
- **Consistent with existing patterns:** Same mocking, rendering, and assertion patterns as current tests.
