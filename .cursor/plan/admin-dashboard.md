## Product Requirements Document: Admin Dashboard (User Management)

### Summary
Build an admin-only dashboard and user management experience (list + detail) for managing users. Pages are hidden unless the viewer is an admin. Data is queried server-side and consumed client-side with TanStack Query caching.

---

## Goals
- Provide admin-only pages to:
  - Monitor high-level user/system activity (users, signups, MAU).
  - Search, filter, sort, and paginate all users.
  - View and edit a user’s full profile record.
  - Hard-delete a user (only from User Details with typed confirmation).

## Non-goals (v1)
- No automated tests required.

---

## Users & Permissions

### Admin definition (source of truth)
- Admin authorization is determined by Better Auth’s admin plugin configuration (e.g., `adminUserIds` in `src/auth/auth.server.ts`).
- Do not rely on `user.role` as the authority for access control in v1. Use APIs, for example, `auth.api.userHasRole`.

### Access rules
- Only admins can:
  - See the Admin sidebar group and navigate to admin routes.
  - Visit `/admin/*` routes.
- Unauthorized access behavior:
  - If the visitor is not allowed (not admin or not signed in), redirect to `/signin`.

### Navigation visibility
- Admin nav items are hidden by default and only rendered for admins.

---

## Information Architecture (Routes)

### Side menu (Admin)
`src/components/nav-admin.tsx` displays an “Admin” group with 2 items:
- Dashboard → `/admin/dashboard`
- User → `/admin/user`

### Routes to build
- `/admin/dashboard`
- `/admin/user`
- `/admin/user/:userId`

> Note: These routes map to TanStack Router file routes under `src/routes/_protected/admin/*` and use the admin layout route `src/routes/_protected/admin.tsx`.

---

## Breadcrumbs
Breadcrumbs are driven by route `staticData.title` and rendered by `src/components/dynamic-breadcrumb.tsx`.

### Requirements
- Each admin route must set `staticData.title` so breadcrumbs display:
  - Admin → Dashboard
  - Admin → User
  - Admin → User → User Details (or equivalent fixed label)

---

## Page Requirements

### 1) Admin Dashboard
**Route:** `/admin/dashboard`

#### Layout
- Responsive across mobile/tablet/desktop.
- Top section: horizontally arranged metric cards (wrap on smaller screens).
- Bottom section: charts.

#### Metric cards (v1)

##### Total Users
- Definition: total row count of `user` table.

##### Signups Today (primary card)
- Definition of “today”: based on the admin’s browser/local timezone day boundaries.
- Primary value: number of users with `user.createdAt` within “today”.
- Secondary breakdown:
  - Verified today: among today’s signups, count where `user.emailVerified = true` at query time.
  - Unverified today: among today’s signups, count where `user.emailVerified = false` at query time.

#### Charts (v1)

##### User chart (Signups)
- Type: stacked bar chart with legend.
- Series:
  - Verified signups (emailVerified = true at query time)
  - Unverified signups (emailVerified = false at query time)
- X-axis buckets: daily.
- Date ranges (toggle):
  - Last 7 days (daily buckets)
  - Last 30 days (daily buckets)
  - Last 3 months (daily buckets)
- Timezone: admin browser/local timezone for bucket boundaries.

##### MAU chart
- Type: area chart.
- Definition (MAU): infer activity using `user.lastSignInAt` (the most recent sign-in timestamp).
- X-axis buckets: daily.
- Date ranges (toggle):
  - Last 7 days (daily)
  - Last 30 days (daily)
  - Last 3 months (daily)
- Timezone: admin browser/local timezone for bucket boundaries.
- Daily point definition (recommended):
  - For each day bucket \([dayStart, dayEnd)\), report the count of users considered “monthly active” as of that day:
    - Let `windowStart = dayStart - 30 days`.
    - Count users where `user.lastSignInAt >= windowStart` AND `user.lastSignInAt < dayEnd`.
  - The 30-day MAU window is fixed and does not change with the toggle; the toggle only changes how many days are shown.

#### States
- Loading: skeleton cards + chart skeletons.
- Empty: charts show “No data”, cards show 0.
- Error: inline error with retry.

---

### 2) Admin User List
**Route:** `/admin/user`

#### Table: core behavior
- Display all users in a table with:
  - Pagination
  - Sorting
  - Column visibility toggles
  - Search
  - Status filter tabs

#### Pagination
- Show current page and total pages.
- Rows per page:
  - Default: 10
  - Options: 10, 50, 100
- Show total number of rows below the table.

#### Sorting
- Clicking a column cycles: Ascending → Descending → None.
- When sorting is “None”, revert to database default ordering (explicitly defined in server query; e.g., `createdAt desc`).

#### Search
- Search input above table.
- Searches by: `id`, `email`, `name`.
- Behavior:
  - Debounced input (e.g., 250–400ms).
  - Case-insensitive partial match for name/email.
  - Exact or prefix match for id (implementation choice).

#### Filter tabs
- Tabs above table: All, Verified, Unverified, Banned.
- Verified/Unverified uses `user.emailVerified`.
- Banned uses `user.banned`.

#### Columns
- Column display order (default):
  1) id
  2) name
  3) email
  4) email verified
  5) role
  6) banned
  7) banned reason
  8) ban expired
  9) created at
  10) updated at
- Column visibility:
  - Email is always shown (cannot hide).
  - All other columns can be shown/hidden.
- Badges with icons:
  - email verified: only show a `Verified` badge with icon when `user.emailVerified` is true; otherwise leave the cell blank.
  - banned: only show a `Banned` badge with icon when `user.banned` is true; otherwise leave the cell blank.
  - role (badge; not used for authorization in v1)

#### Row navigation & actions
- Clicking the email navigates to `/admin/user/<user_id>`.
- Row action dropdown includes:
  - Edit → navigates to `/admin/user/<user_id>`.
- Delete action is not available from the table in v1.

#### States
- Loading: table skeleton rows.
- Empty: “No users found.” / “No results. Clear filters.”
- Error: inline error + retry.

---

### 3) User Details
**Route:** `/admin/user/<user_id>`

#### Header & navigation
- Breadcrumbs: Admin → User → User Details.
- Provide an explicit back affordance in the UI (e.g., back arrow/button) to return to previous page.
- Browser back should also work.

#### User form (editable)
- Display all user information in an editable form.
- Use appropriate UI components by input type:
  - Booleans (e.g., `emailVerified`, `banned`): Checkbox / Switch.
  - Timestamps (e.g., `banExpires`): datetime picker input (or a validated text input if no picker is available).
  - Free text (e.g., `name`, `image`, `banReason`): text input (textarea if needed).
  - Role: select/dropdown (even though role does not control authorization in v1).
- Buttons:
  - Save

##### Fields (from `user` table)
- id (read-only)
- name
- email
- emailVerified
- image
- role
- banned
- banReason
- banExpires
- lastSignInAt (read-only)
- createdAt (read-only)
- updatedAt (read-only)

##### Save behavior
- Validate inputs (e.g., email format).
- Enable the Save button only when there are unsaved changes (i.e., the form is dirty).
- On Save (pending state): disable the Save button and show a loading indicator in the button while the request is in-flight.
- On Save success: persist server-side, show a success toast, update cached queries.
- On Save failure: show an error toast and keep the admin on the page (no navigation).

#### Delete user (danger zone)
- Deletion can only be initiated from the User Details page.
- Provide a clearly separated “Danger zone” section with a destructive “Delete user” button.
- Clicking “Delete user” opens a confirmation dialog that includes:
  - Strong warning that deletion is irreversible.
  - A text input requiring admin to type `DELETE` exactly (case-sensitive) to proceed.
  - A Cancel button to close the dialog without deleting.
  - A destructive Confirm delete button disabled until confirmation input matches `DELETE`.
- On Delete (pending state): disable the destructive Confirm delete button and show a loading indicator in the button while the delete request is in-flight.
- On confirm:
  - Perform hard delete of the user record (with cascade effects per schema).
  - Show success toast and navigate back to `/admin/user`.
- On failure:
  - Show error toast and keep admin on the page.

#### States
- Loading: form skeleton.
- Not found: navigating to `/admin/user/<user_id>` for a user that does not exist must render a true 404 (Not Found). Using the existing generic `NotFound` component (`src/components/not-found.tsx`) is sufficient.
- Error: inline error + retry.

---

## Frontend Design Requirements
- Clean, modern, minimalistic UI.
- Use shadcn/ui components.
- Take inspiration from `/dashboard`.
- Responsive dashboard cards and charts.

---

## Technical Requirements

### Stack & patterns
- TanStack Router for routing (file-based).
- TanStack Query for client caching and data synchronization.
- TanStack Form for user edit form (recommended).
- Server-side database queries (TanStack Start server functions / server routes).

### Data fetching & caching
- Fetch dashboard metrics and chart series via server-side endpoints/functions.
- Use TanStack Query caching:
  - Cache dashboard data per range toggle (7/30/90 days).
  - Invalidate user list on user deletes and updates.
  - Invalidate user detail on save/delete.

### Backend caching (optional)
- Optional short-lived caching allowed for dashboard metrics/charts.
- Slight inaccuracies are acceptable for brief periods.

### Database indexing (performance)
Review `src/db/schema.ts` and add missing indexes to support:
- User list filtering/sorting/search:
  - `user.createdAt`
  - `user.emailVerified`
  - `user.banned`
  - `user.lastSignInAt` (supports MAU chart queries)
  - (`user.email` is already unique)
- Dashboard queries:
  - `user.lastSignInAt` (MAU chart)
  - additional indexes as needed based on query plans

### Security
- Enforce admin authorization on the server for all `/admin/*` data endpoints.
- Do not rely solely on client-side hiding of navigation.

---

## Acceptance Criteria (high level)
- Admin users can see Admin sidebar group and access `/admin/dashboard`, `/admin/user`, `/admin/user/:userId`.
- Non-admins and signed-out users are redirected to `/signin` when attempting `/admin/*`.
- Dashboard renders cards and charts with correct metric definitions and range toggles.
- User list supports pagination, sorting, search, filter tabs, and column visibility rules.
- User details supports editing and saving user fields.
- Hard delete is only available from User Details, gated behind typed confirmation `DELETE`, with Cancel support and clear warnings.
