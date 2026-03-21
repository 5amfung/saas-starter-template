# Depth-First Test Coverage — Design Spec

**Date:** 2026-03-20
**Goal:** Close the highest-risk test coverage gaps with thorough, depth-first testing of server functions, workspace hooks, and critical integration flows.
**Scope:** Unit tests + integration tests only (no E2E/Playwright).

---

## 1. Server Function Tests

Server functions (`*.functions.ts`) are the auth + validation boundary between client and server. All three untested files follow the same pattern: `createServerFn().inputValidator().handler()`. Tests mock at the module boundary and verify auth gating, argument delegation, and return values.

### 1.1 `admin.functions.test.ts`

**File under test:** `apps/web/src/admin/admin.functions.ts`
**Location:** `apps/web/test/unit/admin/admin.functions.test.ts`

3 functions: `getAdminDashboardMetrics`, `getSignupChartData`, `getMauChartData`

**Mocks required:**

- `@tanstack/react-start` — `createServerFn` builder (reuse existing pattern from `workspace.functions.test.ts`)
- `@/admin/admin.server` — `requireAdmin`, `queryDashboardMetrics`, `querySignupChartData`, `queryMauChartData`

**Test cases (9):**

| Function                   | Test Case                                                    | Assertion                                       |
| -------------------------- | ------------------------------------------------------------ | ----------------------------------------------- |
| `getAdminDashboardMetrics` | Rejects when `requireAdmin()` throws                         | Expect rejection with admin error               |
| `getAdminDashboardMetrics` | Passes `timezoneOffset` to `queryDashboardMetrics`           | `queryDashboardMetrics` called with correct arg |
| `getAdminDashboardMetrics` | Returns query result                                         | Result matches mock return value                |
| `getSignupChartData`       | Rejects when `requireAdmin()` throws                         | Expect rejection with admin error               |
| `getSignupChartData`       | Passes `days` and `timezoneOffset` to `querySignupChartData` | Correct args forwarded                          |
| `getSignupChartData`       | Returns query result                                         | Result matches mock return value                |
| `getMauChartData`          | Rejects when `requireAdmin()` throws                         | Expect rejection with admin error               |
| `getMauChartData`          | Passes `days` and `timezoneOffset` to `queryMauChartData`    | Correct args forwarded                          |
| `getMauChartData`          | Returns query result                                         | Result matches mock return value                |

### 1.2 `billing.functions.test.ts`

**File under test:** `apps/web/src/billing/billing.functions.ts`
**Location:** `apps/web/test/unit/billing/billing.functions.test.ts`

6 functions: `getInvoices`, `createCheckoutSession`, `createPortalSession`, `getUserBillingData`, `reactivateSubscription`, `checkPlanLimit`

**Mocks required:**

- `@tanstack/react-start` — `createServerFn` builder
- `@tanstack/react-start/server` — `getRequestHeaders`
- `@/billing/billing.server` — `requireVerifiedSession`, `createCheckoutForPlan`, `createUserBillingPortal`, `getBillingData`, `reactivateUserSubscription`, `checkUserPlanLimit`
- `@/init` — `auth.billing.getInvoicesForUser`

**Test cases (18):**

| Function                 | Test Case                                                                          | Assertion           |
| ------------------------ | ---------------------------------------------------------------------------------- | ------------------- |
| `getInvoices`            | Rejects when session not verified                                                  | Expect rejection    |
| `getInvoices`            | Calls `auth.billing.getInvoicesForUser` with user ID                               | Correct arg         |
| `getInvoices`            | Returns invoice list                                                               | Result matches mock |
| `createCheckoutSession`  | Rejects when session not verified                                                  | Expect rejection    |
| `createCheckoutSession`  | Passes `planId`, `annual`, and headers to `createCheckoutForPlan`                  | Correct args        |
| `createCheckoutSession`  | Returns checkout result                                                            | Result matches mock |
| `createPortalSession`    | Rejects when session not verified                                                  | Expect rejection    |
| `createPortalSession`    | Calls `createUserBillingPortal` with headers                                       | Correct args        |
| `createPortalSession`    | Returns portal URL                                                                 | Result matches mock |
| `getUserBillingData`     | Rejects when session not verified                                                  | Expect rejection    |
| `getUserBillingData`     | Passes headers and user ID to `getBillingData`                                     | Correct args        |
| `getUserBillingData`     | Returns billing data                                                               | Result matches mock |
| `reactivateSubscription` | Rejects when session not verified                                                  | Expect rejection    |
| `reactivateSubscription` | Calls `reactivateUserSubscription` with headers and user ID                        | Correct args        |
| `reactivateSubscription` | Returns reactivation result                                                        | Result matches mock |
| `checkPlanLimit`         | Rejects when session not verified                                                  | Expect rejection    |
| `checkPlanLimit`         | Passes headers, user ID, feature, and optional workspaceId to `checkUserPlanLimit` | Correct args        |
| `checkPlanLimit`         | Returns plan limit check result                                                    | Result matches mock |

### 1.3 `notification-preferences.functions.test.ts`

**File under test:** `apps/web/src/account/notification-preferences.functions.ts`
**Location:** `apps/web/test/unit/account/notification-preferences.functions.test.ts`

2 functions: `getNotificationPreferences`, `updateNotificationPreferences`

**Mocks required:**

- `@tanstack/react-start` — `createServerFn` builder
- `@/account/notification-preferences.server` — `requireVerifiedSession`, `getNotificationPreferencesForUser`, `upsertNotificationPreferencesForUser`

**Test cases (6):**

| Function                        | Test Case                                                               | Assertion           |
| ------------------------------- | ----------------------------------------------------------------------- | ------------------- |
| `getNotificationPreferences`    | Rejects when session not verified                                       | Expect rejection    |
| `getNotificationPreferences`    | Calls `getNotificationPreferencesForUser` with user ID                  | Correct arg         |
| `getNotificationPreferences`    | Returns preferences                                                     | Result matches mock |
| `updateNotificationPreferences` | Rejects when session not verified                                       | Expect rejection    |
| `updateNotificationPreferences` | Passes user ID and input data to `upsertNotificationPreferencesForUser` | Correct args        |
| `updateNotificationPreferences` | Returns upsert result                                                   | Result matches mock |

---

## 2. Workspace Hook Tests

These hooks contain significant client-side business logic: data fetching, mutations, pagination, sorting, validation, and error handling. Tests use `renderHook` with `createHookWrapper()`.

### 2.1 `use-invitations-table.test.ts`

**File under test:** `apps/web/src/workspace/use-invitations-table.ts`
**Location:** `apps/web/test/unit/workspace/use-invitations-table.test.ts`

**Mocks required:**

- `@workspace/auth/client` — `authClient.organization.listInvitations`, `.inviteMember`, `.cancelInvitation`
- `sonner` — `toast.success`, `toast.error`

**Test cases (18):**

**Query & Data:**

- Fetches invitations and filters to `pending` status only
- Maps invitation data to `WorkspaceInvitationRow` shape (`id`, `email`, `role`, `invitedAt`)
- Returns `isLoading: true` while query is pending

**Pagination:**

- Defaults to page 1 and `INVITATION_PAGE_SIZE_DEFAULT`
- Slices data correctly based on page and pageSize
- Resets to page 1 when pageSize changes
- Resets to page 1 when sorting changes
- Calculates `totalPages` correctly (at least 1)

**Sorting:**

- Sorts by `invitedAt` ascending/descending
- Sorts by `email` (string compare) as default sort field
- No sorting applied when `sorting` state is empty

**Invite Dialog — `submitInvite`:**

- Shows error toast when email is empty
- Shows error toast when email format is invalid (Zod validation)
- Shows error toast when role is not in `DEFAULT_INVITE_ROLES`
- Calls `inviteMember` with lowercase trimmed email, role, and `organizationId`
- On success: shows success toast, closes dialog, resets draft, refetches invitations
- On mutation error: shows error toast with error message

**Remove invitation:**

- Calls `cancelInvitation` with invitation ID
- On success: shows success toast, refetches
- On error: shows error toast

**Resend invitation:**

- Calls `inviteMember` with `resend: true`
- Falls back invalid role to `'member'`

### 2.2 `use-members-table.test.ts`

**File under test:** `apps/web/src/workspace/use-members-table.ts`
**Location:** `apps/web/test/unit/workspace/use-members-table.test.ts`

**Mocks required:**

- `@workspace/auth/client` — `authClient.organization.listMembers`, `.getActiveMemberRole`, `.leave`, `.removeMember`
- `@tanstack/react-router` — `useNavigate`
- `@/hooks/use-session-query` — `useSessionQuery`
- `sonner` — `toast.success`, `toast.error`

**Test cases (12):**

**Query & Data:**

- Fetches members with pagination params (limit, offset, sortBy, sortDirection)
- Maps member data to `WorkspaceMemberRow` shape
- Fetches current user's active role
- Returns `currentUserId` from session

**Pagination:**

- Resets to page 1 when pageSize changes
- Resets to page 1 when sorting changes
- Uses `keepPreviousData` for smooth pagination transitions

**Leave workspace:**

- Calls `organization.leave` with `organizationId`
- On success: shows success toast, navigates to `/ws`
- On error: shows error toast

**Remove member:**

- Calls `removeMember` with member ID and `organizationId`
- On success: shows success toast, refetches members
- On error: shows error toast
- Tracks `removingMemberId` during mutation

---

## 3. Integration Tests

Integration tests render full component trees with `renderWithProviders()`, simulate user interactions with `userEvent`, and assert on the resulting UI state. All API calls are mocked at the `authClient` / server function boundary.

### 3.1 `workspace-invite-flow.integration.test.tsx`

**Location:** `apps/web/test/integration/components/workspace/workspace-invite-flow.integration.test.tsx`

**Components involved:** `WorkspaceInviteDialog`, `WorkspaceInvitationsTable`

**Test cases (6):**

- Open invite dialog → type email → select role → submit → mock returns success → dialog closes, success toast
- Submit with empty email → validation error shown
- Submit with invalid email format → validation error shown
- Submit → API returns error → error message displayed, dialog stays open
- Remove invitation → cancel mutation called → invitation disappears from table after refetch
- Resend invitation → invite mutation called with `resend: true` → success toast

### 3.2 `billing-upgrade-flow.integration.test.tsx`

**Location:** `apps/web/test/integration/components/billing/billing-upgrade-flow.integration.test.tsx`

**Components involved:** `BillingPage`, `BillingPlanCards`, `UpgradePromptDialog`

**Test cases (6):**

- Renders current plan details from billing data
- Click upgrade on a plan → `createCheckoutSession` called with plan ID and billing cycle
- Checkout session creation fails → error feedback shown
- Reactivate canceled subscription → `reactivateSubscription` called → success feedback
- Reactivation fails → error feedback shown
- Billing portal link → `createPortalSession` called → opens portal URL

### 3.3 `workspace-members-flow.integration.test.tsx`

**Location:** `apps/web/test/integration/components/workspace/workspace-members-flow.integration.test.tsx`

**Components involved:** `WorkspaceMembersTable`

**Test cases (6):**

- Renders member list from query data
- Remove member → confirm → `removeMember` called → member removed from table
- Remove member fails → error toast shown, member still in table
- Leave workspace → `organization.leave` called → navigates to `/ws`
- Leave workspace fails → error toast shown
- Shows loading state while data is fetching

### 3.4 `account-notifications-flow.integration.test.tsx`

**Location:** `apps/web/test/integration/components/account/account-notifications-flow.integration.test.tsx`

**Components involved:** Notification preferences form/switches

**Test cases (4):**

- Loads existing notification preferences on mount
- Toggle a preference → save → `updateNotificationPreferences` called with updated values
- Save fails → error feedback
- All preferences default to expected initial state

---

## 4. Utility Test

### 4.1 `workspace-members.types.test.ts`

**File under test:** `apps/web/src/workspace/workspace-members.types.ts`
**Location:** `apps/web/test/unit/workspace/workspace-members.types.test.ts`

**Test cases (3):**

- `withPendingId` sets pending ID before action runs
- `withPendingId` clears pending ID after successful action
- `withPendingId` clears pending ID even when action throws (finally block)

---

## 5. Conventions

All new tests follow established patterns:

- **Mock declaration:** `vi.hoisted()` for all mock functions, then `vi.mock()` for modules
- **createServerFn mock:** Reuse the builder pattern from `workspace.functions.test.ts`
- **Factories:** Use `createMockSessionResponse()`, `createMockWorkspace()`, `createMockMemberRow()`, etc. from `@workspace/test-utils`
- **Hook tests:** `renderHook()` with `createHookWrapper()` for QueryClient context
- **Integration tests:** `renderWithProviders()` for QueryClient context, `userEvent.setup()` for interactions
- **Environment:** `// @vitest-environment jsdom` directive for all DOM tests
- **Cleanup:** `vi.clearAllMocks()` in `beforeEach`
- **Assertions:** Prefer `getByRole` / `getByLabelText` over `getByText` for component queries

## 6. File Summary

| #   | Test File                                                                             | Type        | Est. Cases |
| --- | ------------------------------------------------------------------------------------- | ----------- | ---------- |
| 1   | `test/unit/admin/admin.functions.test.ts`                                             | Unit        | 9          |
| 2   | `test/unit/billing/billing.functions.test.ts`                                         | Unit        | 18         |
| 3   | `test/unit/account/notification-preferences.functions.test.ts`                        | Unit        | 6          |
| 4   | `test/unit/workspace/use-invitations-table.test.ts`                                   | Unit        | 18         |
| 5   | `test/unit/workspace/use-members-table.test.ts`                                       | Unit        | 12         |
| 6   | `test/unit/workspace/workspace-members.types.test.ts`                                 | Unit        | 3          |
| 7   | `test/integration/components/workspace/workspace-invite-flow.integration.test.tsx`    | Integration | 6          |
| 8   | `test/integration/components/billing/billing-upgrade-flow.integration.test.tsx`       | Integration | 6          |
| 9   | `test/integration/components/workspace/workspace-members-flow.integration.test.tsx`   | Integration | 6          |
| 10  | `test/integration/components/account/account-notifications-flow.integration.test.tsx` | Integration | 4          |
|     | **Total**                                                                             |             | **~88**    |
