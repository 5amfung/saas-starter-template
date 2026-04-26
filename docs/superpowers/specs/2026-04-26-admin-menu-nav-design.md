# Admin Menu Nav Design

Date: 2026-04-26

## Summary

Add an `Admin` option to the signed-in user dropdown in the web app sidebar. The option should appear between `Notifications` and `Log out` only when the current user can enter the admin app under the existing admin entry policy.

The menu item should navigate to `/admin`. The existing `/admin` route will continue to own the final redirect to `/admin/dashboard`, `/admin/access-denied`, `/signin`, or `/verify`.

## Goals

- Give platform admins a clear shortcut from the customer shell to the admin area.
- Follow the existing admin entry policy instead of duplicating raw `user.role` checks in the sidebar.
- Keep `/admin` route guards as the source of truth for actual admin access.
- Keep the change scoped to the user dropdown composition and focused component tests.

## Non-Goals

- Creating new admin routes or changing admin route redirects.
- Changing how platform admin roles are stored in the user table.
- Adding a new database query for the sidebar.
- Showing the shortcut to users who have `role: "admin"` but cannot currently enter admin because the existing entry policy blocks them.
- Moving the customer account menu into a shared package or new abstraction.

## Current Context

The customer shell sidebar is rendered by `apps/web/src/components/app-sidebar.tsx`.

Today, `AppSidebar`:

- reads the current session with `authClient.useSession()`,
- builds a `user` object for the footer,
- passes static user dropdown items into `NavUser`,
- includes `Account`, `Billing`, and `Notifications`.

The user dropdown component lives at `apps/web/src/components/layout/nav-user.tsx`. It already accepts a generic `menuItems` prop and maps each item into a `DropdownMenuItem`, so the dropdown does not need admin-specific knowledge.

Admin access policy already exists in:

- `apps/web/src/policy/core/admin-app.ts`
- `apps/web/src/policy/admin-app-capabilities.shared.ts`
- `apps/web/src/policy/admin-app-capabilities.ts`
- `apps/web/src/policy/admin-app-capabilities.server.ts`

`getAdminAppEntryFacts()` maps a session into `platformRole: "admin"` only when `session.user.role === "admin"`, and the entry policy also accounts for session and email verification state. The client helper `useAdminAppCapabilities()` returns `capabilities.canAccessAdminApp`, which is the correct visibility flag for this shortcut.

The `/admin` route already calls `getAdminAppEntry()` and redirects through the canonical admin entry flow. That route should remain the navigation target for the menu item.

## Recommended Design

Update `AppSidebar` to read existing admin capabilities:

```tsx
const { capabilities: adminAppCapabilities } = useAdminAppCapabilities();
```

Build the user menu items in one array:

```tsx
const userMenuItems = [
  { label: 'Account', icon: <IconUserCircle />, href: '/account' },
  { label: 'Billing', icon: <IconCreditCard />, href: '/billing' },
  {
    label: 'Notifications',
    icon: <IconNotification />,
    href: '/notifications',
  },
  ...(adminAppCapabilities.canAccessAdminApp
    ? [{ label: 'Admin', icon: <IconShield />, href: '/admin' }]
    : []),
];
```

Then pass `userMenuItems` into `NavUser`.

This keeps admin visibility in the customer shell aligned with the same policy that protects `/admin`, without making `NavUser` aware of user roles or admin policy details.

## Alternatives Considered

### Option A: use `useAdminAppCapabilities()` in `AppSidebar`

Recommended.

Why:

- reuses existing admin entry policy,
- respects the approved requirement that visibility follows policy, not only table role,
- avoids adding a sidebar-specific server query,
- keeps `NavUser` presentational and generic.

Tradeoff:

- the shortcut relies on the client session snapshot, as other shell UI does. The `/admin` route still re-checks access before rendering protected admin UI.

### Option B: check `session.user.role === "admin"` directly

Rejected.

Why not:

- duplicates policy logic in a component,
- would show the shortcut for an unverified admin user even though `/admin` would redirect to verification,
- makes future admin-entry policy changes easier to miss in the sidebar.

### Option C: call the server-backed admin entry query for the sidebar

Rejected for this change.

Why not:

- stricter, but unnecessary for a shortcut that is still guarded by `/admin`,
- adds another async query to a sidebar that already depends on session and workspace data,
- duplicates work already represented by `useAdminAppCapabilities()`.

## Files Expected To Change

Primary:

- `apps/web/src/components/app-sidebar.tsx`

Tests:

- `apps/web/test/unit/components/app-sidebar.test.tsx`

No change is expected in:

- `apps/web/src/components/layout/nav-user.tsx`
- admin route files
- admin policy files
- database schema or migrations

## Testing Plan

Update the `AppSidebar` unit test mock for `NavUser` so it renders or exposes received `menuItems`.

Add focused tests covering:

- a normal signed-in user does not receive the `Admin` menu item,
- a signed-in user whose admin entry policy allows admin access receives `Admin`,
- the `Admin` item points to `/admin`,
- existing `Account`, `Billing`, and `Notifications` items remain present.

Expected targeted command:

```bash
pnpm --filter @workspace/web test test/unit/components/app-sidebar.test.tsx
```

If implementation changes imports or policy boundaries in a non-local way, also run:

```bash
pnpm run check:boundaries
```

## Risks And Tradeoffs

The main risk is confusing menu visibility with authorization. This design avoids that by keeping the menu as a convenience shortcut only. Actual authorization remains in the `/admin` route and server-side admin capability checks.

The main tradeoff is avoiding a fresh server query in favor of the existing client-side policy helper. That is acceptable because this only controls whether a shortcut is visible; protected admin routes still enforce the policy before rendering.

## Definition Of Done

- `Admin` appears in the user dropdown only when `canAccessAdminApp` is true.
- The item navigates to `/admin`.
- The existing account menu items and logout behavior remain unchanged.
- Focused sidebar unit tests pass.
