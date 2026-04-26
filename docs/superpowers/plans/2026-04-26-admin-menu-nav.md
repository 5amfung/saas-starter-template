# Admin Menu Nav Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an `Admin` option to the signed-in web sidebar user dropdown when the existing admin entry policy allows the current user into `/admin`.

**Architecture:** Keep `NavUser` presentational and generic. Compute the account dropdown item list in `AppSidebar`, using `useAdminAppCapabilities().capabilities.canAccessAdminApp` as the visibility flag, then link the item to `/admin` so the existing admin route remains the final access/redirect boundary.

**Tech Stack:** React 19, TanStack Router, Better Auth client session, existing admin policy helpers, Tabler icons, Vitest, Testing Library.

---

## File Structure

- Modify `apps/web/src/components/app-sidebar.tsx`
  - Import the existing `useAdminAppCapabilities` hook.
  - Import an admin-appropriate Tabler icon.
  - Build a `userMenuItems` array and conditionally append `Admin`.
  - Pass the array to `NavUser`.

- Modify `apps/web/test/unit/components/app-sidebar.test.tsx`
  - Mock `useAdminAppCapabilities`.
  - Update the `NavUser` mock so the test can inspect received menu items.
  - Add coverage for normal users and admin-capable users.

- Do not modify `apps/web/src/components/layout/nav-user.tsx`
  - It already accepts generic menu items and handles navigation.

## Task 1: Add Sidebar Tests For Admin Menu Visibility

**Files:**

- Modify: `apps/web/test/unit/components/app-sidebar.test.tsx`

- [ ] **Step 1: Extend hoisted mocks**

Add `useAdminAppCapabilitiesMock` to the hoisted mock block:

```tsx
const {
  useSessionMock,
  useActiveOrganizationMock,
  useWorkspaceCapabilitiesQueryMock,
  useAdminAppCapabilitiesMock,
  useRouterStateMock,
  useWorkspaceListQueryMock,
  useWorkspaceDetailQueryMock,
  useWorkspaceSwitcherTriggerDetailQueryMock,
} = vi.hoisted(() => ({
  useSessionMock: vi.fn(),
  useActiveOrganizationMock: vi.fn(),
  useWorkspaceCapabilitiesQueryMock: vi.fn(),
  useAdminAppCapabilitiesMock: vi.fn(),
  useRouterStateMock: vi.fn(),
  useWorkspaceListQueryMock: vi.fn(),
  useWorkspaceDetailQueryMock: vi.fn(),
  useWorkspaceSwitcherTriggerDetailQueryMock: vi.fn(),
}));
```

- [ ] **Step 2: Mock the admin capability hook**

Add this module mock near the workspace capability mock:

```tsx
vi.mock('@/policy/admin-app-capabilities', () => ({
  useAdminAppCapabilities: useAdminAppCapabilitiesMock,
}));
```

- [ ] **Step 3: Make the `NavUser` mock expose menu items**

Replace the current `NavUser` mock with:

```tsx
NavUser: ({
  user,
  menuItems,
}: {
  user: { name: string; email: string };
  menuItems: Array<{ label: string; href: string }>;
}) => (
  <div data-testid="nav-user" data-name={user.name}>
    {menuItems.map((item) => (
      <a key={item.href} href={item.href}>
        {item.label}
      </a>
    ))}
  </div>
),
```

- [ ] **Step 4: Set a default non-admin capability**

In `beforeEach`, add:

```tsx
useAdminAppCapabilitiesMock.mockReturnValue({
  session: mockSession,
  isPending: false,
  capabilities: {
    platformRole: 'user',
    canAccessAdminApp: false,
    canViewDashboard: false,
    canViewAdminDashboard: false,
    canViewAnalytics: false,
    canViewUsers: false,
    canManageUsers: false,
    canDeleteUsers: false,
    canViewWorkspaces: false,
    canViewWorkspaceBilling: false,
    canManageEntitlementOverrides: false,
    canPerformSupportActions: false,
  },
});
```

- [ ] **Step 5: Add tests for absent and present Admin item**

Add these tests in the `AppSidebar` describe block:

```tsx
it('passes the default account menu items to NavUser without Admin for non-admin users', async () => {
  useSessionMock.mockReturnValue({ data: mockSession, isPending: false });
  useActiveOrganizationMock.mockReturnValue({ data: null });
  useWorkspaceListQueryMock.mockReturnValue({ data: [] });

  await renderSidebar();

  expect(screen.getByRole('link', { name: 'Account' })).toHaveAttribute(
    'href',
    '/account'
  );
  expect(screen.getByRole('link', { name: 'Billing' })).toHaveAttribute(
    'href',
    '/billing'
  );
  expect(screen.getByRole('link', { name: 'Notifications' })).toHaveAttribute(
    'href',
    '/notifications'
  );
  expect(screen.queryByRole('link', { name: 'Admin' })).not.toBeInTheDocument();
});

it('adds the Admin account menu item when admin entry policy allows access', async () => {
  useSessionMock.mockReturnValue({
    data: { user: { ...mockUser, role: 'admin' as const } },
    isPending: false,
  });
  useActiveOrganizationMock.mockReturnValue({ data: null });
  useWorkspaceListQueryMock.mockReturnValue({ data: [] });
  useAdminAppCapabilitiesMock.mockReturnValue({
    session: { user: { ...mockUser, role: 'admin' as const } },
    isPending: false,
    capabilities: {
      platformRole: 'admin',
      canAccessAdminApp: true,
      canViewDashboard: true,
      canViewAdminDashboard: true,
      canViewAnalytics: true,
      canViewUsers: true,
      canManageUsers: true,
      canDeleteUsers: true,
      canViewWorkspaces: true,
      canViewWorkspaceBilling: true,
      canManageEntitlementOverrides: true,
      canPerformSupportActions: true,
    },
  });

  await renderSidebar();

  const links = screen.getAllByRole('link').map((link) => ({
    label: link.textContent,
    href: link.getAttribute('href'),
  }));
  expect(links).toEqual([
    { label: 'Account', href: '/account' },
    { label: 'Billing', href: '/billing' },
    { label: 'Notifications', href: '/notifications' },
    { label: 'Admin', href: '/admin' },
  ]);
});
```

- [ ] **Step 6: Run the focused test and confirm it fails**

Run:

```bash
pnpm --filter @workspace/web test test/unit/components/app-sidebar.test.tsx
```

Expected: the new admin-capable test fails because `AppSidebar` does not pass an `Admin` menu item yet. Existing tests should still compile after the mock updates.

## Task 2: Implement Policy-Based Admin Menu Item

**Files:**

- Modify: `apps/web/src/components/app-sidebar.tsx`

- [ ] **Step 1: Import admin icon and policy hook**

Update imports:

```tsx
import {
  IconCreditCard,
  IconDashboard,
  IconFolder,
  IconHelp,
  IconHome,
  IconNotification,
  IconPlugConnected,
  IconSearch,
  IconSettings,
  IconShield,
  IconStack2,
  IconUserCircle,
  IconUsers,
} from '@tabler/icons-react';
```

Add:

```tsx
import { useAdminAppCapabilities } from '@/policy/admin-app-capabilities';
```

- [ ] **Step 2: Read admin capabilities in `AppSidebar`**

After the workspace capability query, add:

```tsx
const { capabilities: adminAppCapabilities } = useAdminAppCapabilities();
```

- [ ] **Step 3: Build account menu items before render**

After the `user` constant, add:

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

- [ ] **Step 4: Pass the computed array to `NavUser`**

Replace the inline `menuItems` array with:

```tsx
<NavUser user={user} menuItems={userMenuItems} />
```

- [ ] **Step 5: Run the focused test and confirm it passes**

Run:

```bash
pnpm --filter @workspace/web test test/unit/components/app-sidebar.test.tsx
```

Expected: all tests in `app-sidebar.test.tsx` pass.

## Task 3: Verify And Commit

**Files:**

- Verify: `apps/web/src/components/app-sidebar.tsx`
- Verify: `apps/web/test/unit/components/app-sidebar.test.tsx`
- Verify: `docs/superpowers/plans/2026-04-26-admin-menu-nav.md`

- [ ] **Step 1: Run formatter-sensitive targeted test command**

Run:

```bash
pnpm --filter @workspace/web test test/unit/components/app-sidebar.test.tsx
```

Expected: PASS.

- [ ] **Step 2: Run boundary check if imports changed beyond app-local policy**

Because the planned import is app-local (`@/policy/admin-app-capabilities`), this boundary check is optional unless implementation drifts into package or internal imports. If run:

```bash
pnpm run check:boundaries
```

Expected: PASS.

- [ ] **Step 3: Inspect the diff**

Run:

```bash
git diff -- apps/web/src/components/app-sidebar.tsx apps/web/test/unit/components/app-sidebar.test.tsx docs/superpowers/plans/2026-04-26-admin-menu-nav.md
```

Expected: diff shows only the account menu capability hook, conditional `Admin` item, focused tests, and this plan.

- [ ] **Step 4: Commit implementation**

Run:

```bash
git add apps/web/src/components/app-sidebar.tsx apps/web/test/unit/components/app-sidebar.test.tsx docs/superpowers/plans/2026-04-26-admin-menu-nav.md
git commit -m "feat(web): add admin account menu shortcut"
```

Expected: commit succeeds.

## Self-Review

- Spec coverage: The plan covers policy-following visibility, `/admin` target, no `NavUser` changes, no route changes, and focused sidebar tests.
- Placeholder scan: This plan contains no `TODO`, `TBD`, or unspecified implementation steps.
- Type consistency: The planned `menuItems` shape matches `NavUserMenuItem` (`label`, `icon`, `href`), and the test mock only inspects the `label` and `href` fields it needs.
