# SF-27 Workspace Switcher Trigger Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the active workspace plan subtitle and shared/private icon to the workspace switcher trigger without changing dropdown rows.

**Architecture:** Keep the existing dropdown workspace list shape untouched and add a separate active-workspace trigger detail path. Resolve plan name and member count on the server, expose that through the existing workspace query surface, then let `AppSidebar` pass a small `triggerDetail` payload into `WorkspaceSwitcher`.

**Tech Stack:** TanStack Start server functions, TanStack Query, React 19, Better Auth organization APIs, `@workspace/billing`, Vitest, Playwright

---

## File Map

- Modify: `apps/web/src/workspace/workspace.server.ts`
  - Add a focused server helper that returns active trigger details for one workspace.
- Modify: `apps/web/src/workspace/workspace.functions.ts`
  - Expose the server helper through a `createServerFn()` wrapper.
- Modify: `apps/web/src/workspace/workspace.queries.ts`
  - Add the query key and hook for trigger details.
- Modify: `apps/web/src/components/app-sidebar.tsx`
  - Request the trigger details for the active workspace and pass them into `WorkspaceSwitcher`.
- Modify: `apps/web/src/components/workspace-switcher.tsx`
  - Render the plan subtitle and `users` / `lock` icon in the trigger only.
- Modify: `apps/web/test/unit/workspace/workspace.server.test.ts`
  - Add server-helper coverage for plan-name and member-count resolution.
- Modify: `apps/web/test/unit/components/workspace-switcher.test.tsx`
  - Add trigger rendering tests for subtitle and icon selection.
- Modify: `apps/web/test/unit/components/app-sidebar.test.tsx`
  - Add wiring coverage for `triggerDetail` and fallback behavior.
- Modify: `apps/web/test/e2e/workspace/settings.spec.ts`
  - Add one trigger assertion for the default free single-member workspace.

### Task 1: Add active trigger detail server/query support

**Files:**

- Modify: `apps/web/src/workspace/workspace.server.ts`
- Modify: `apps/web/src/workspace/workspace.functions.ts`
- Modify: `apps/web/src/workspace/workspace.queries.ts`
- Test: `apps/web/test/unit/workspace/workspace.server.test.ts`

- [x] **Step 1: Write the failing server helper tests**

```ts
import { getWorkspaceSwitcherTriggerDetail } from '@/workspace/workspace.server';

it('returns plan name and member count for the requested workspace', async () => {
  getFullOrganizationMock.mockResolvedValueOnce({
    id: 'ws-1',
    members: [{ userId: 'user-1' }, { userId: 'user-2' }],
  });
  getAuthMock.mockReturnValue({
    api: {
      listOrganizations: listOrganizationsMock,
      setActiveOrganization: setActiveOrganizationMock,
      getFullOrganization: getFullOrganizationMock,
    },
    billing: {
      resolveWorkspacePlanIdFromDb: vi.fn().mockResolvedValue('pro'),
    },
  });

  const result = await getWorkspaceSwitcherTriggerDetail(new Headers(), 'ws-1');

  expect(result).toEqual({ planName: 'Pro', memberCount: 2 });
});

it('falls back to Free when the workspace has no paid subscription', async () => {
  getFullOrganizationMock.mockResolvedValueOnce({
    id: 'ws-free',
    members: [{ userId: 'user-1' }],
  });
  getAuthMock.mockReturnValue({
    api: {
      listOrganizations: listOrganizationsMock,
      setActiveOrganization: setActiveOrganizationMock,
      getFullOrganization: getFullOrganizationMock,
    },
    billing: {
      resolveWorkspacePlanIdFromDb: vi.fn().mockResolvedValue('free'),
    },
  });

  await expect(
    getWorkspaceSwitcherTriggerDetail(new Headers(), 'ws-free')
  ).resolves.toEqual({ planName: 'Free', memberCount: 1 });
});
```

- [x] **Step 2: Run the server helper test to verify it fails**

Run:

```bash
pnpm --filter @workspace/web test test/unit/workspace/workspace.server.test.ts
```

Expected: FAIL with `getWorkspaceSwitcherTriggerDetail` missing from `workspace.server.ts`.

- [x] **Step 3: Add the server helper and server function wrapper**

```ts
// apps/web/src/workspace/workspace.server.ts
import { getPlanById, getFreePlan } from '@workspace/billing';

export async function getWorkspaceSwitcherTriggerDetail(
  headers: Headers,
  workspaceId: string
) {
  const [organization, planId] = await Promise.all([
    getAuth().api.getFullOrganization({
      headers,
      query: { organizationId: workspaceId },
    }),
    getAuth().billing.resolveWorkspacePlanIdFromDb(workspaceId),
  ]);

  const plan = getPlanById(planId) ?? getFreePlan();

  return {
    planName: plan.name,
    memberCount: organization?.members.length ?? 0,
  };
}
```

```ts
// apps/web/src/workspace/workspace.functions.ts
import { getWorkspaceSwitcherTriggerDetail as getWorkspaceSwitcherTriggerDetailServer } from '@/workspace/workspace.server';

export const getWorkspaceSwitcherTriggerDetail = createServerFn()
  .inputValidator(workspaceRouteInput)
  .handler(async ({ data }) => {
    const headers = getRequestHeaders();
    await requireVerifiedSession(headers);
    await ensureWorkspaceMembership(headers, data.workspaceId);
    return getWorkspaceSwitcherTriggerDetailServer(headers, data.workspaceId);
  });
```

```ts
// apps/web/src/workspace/workspace.queries.ts
import { getWorkspaceSwitcherTriggerDetail } from '@/workspace/workspace.functions';

export const WORKSPACE_SWITCHER_TRIGGER_QUERY_KEY = (workspaceId: string) =>
  ['workspace', 'switcher-trigger', workspaceId] as const;

export function useWorkspaceSwitcherTriggerDetailQuery(
  workspaceId: string | null
) {
  return useQuery({
    queryKey: WORKSPACE_SWITCHER_TRIGGER_QUERY_KEY(workspaceId ?? ''),
    queryFn: () =>
      getWorkspaceSwitcherTriggerDetail({
        data: { workspaceId: workspaceId! },
      }),
    enabled: workspaceId !== null,
  });
}
```

- [x] **Step 4: Run the focused test again to verify it passes**

Run:

```bash
pnpm --filter @workspace/web test test/unit/workspace/workspace.server.test.ts
```

Expected: PASS with the new `getWorkspaceSwitcherTriggerDetail` coverage green.

- [x] **Step 5: Commit the server/query slice**

```bash
git add apps/web/src/workspace/workspace.server.ts apps/web/src/workspace/workspace.functions.ts apps/web/src/workspace/workspace.queries.ts apps/web/test/unit/workspace/workspace.server.test.ts
git commit -m "feat(workspace): add switcher trigger detail query"
```

### Task 2: Render the trigger subtitle and icon in `WorkspaceSwitcher`

**Files:**

- Modify: `apps/web/src/components/workspace-switcher.tsx`
- Test: `apps/web/test/unit/components/workspace-switcher.test.tsx`

- [x] **Step 1: Write the failing trigger rendering tests**

```ts
it('renders the plan subtitle in the trigger when triggerDetail is provided', () => {
  renderWithProviders(
    <WorkspaceSwitcher
      workspaces={defaultWorkspaces}
      activeWorkspaceId="ws-1"
      triggerDetail={{ planName: 'Pro', memberCount: 2 }}
    />
  );

  expect(screen.getByText('Pro')).toBeInTheDocument();
});

it('renders a users icon when the active workspace is shared', () => {
  renderWithProviders(
    <WorkspaceSwitcher
      workspaces={defaultWorkspaces}
      activeWorkspaceId="ws-1"
      triggerDetail={{ planName: 'Pro', memberCount: 2 }}
    />
  );

  expect(screen.getByTestId('workspace-switcher-shared-icon')).toHaveAttribute(
    'data-icon',
    'users'
  );
});

it('renders a lock icon when the active workspace is not shared', () => {
  renderWithProviders(
    <WorkspaceSwitcher
      workspaces={defaultWorkspaces}
      activeWorkspaceId="ws-1"
      triggerDetail={{ planName: 'Free', memberCount: 1 }}
    />
  );

  expect(screen.getByTestId('workspace-switcher-shared-icon')).toHaveAttribute(
    'data-icon',
    'lock'
  );
});
```

- [x] **Step 2: Run the component test to verify it fails**

Run:

```bash
pnpm --filter @workspace/web test test/unit/components/workspace-switcher.test.tsx
```

Expected: FAIL because `triggerDetail` is not part of the component props and the subtitle/icon are not rendered.

- [x] **Step 3: Implement the trigger-only rendering update**

```tsx
import {
  IconLoader2,
  IconLock,
  IconPlus,
  IconSelector,
  IconUsers,
} from '@tabler/icons-react';

export function WorkspaceSwitcher({
  workspaces,
  activeWorkspaceId,
  triggerDetail,
}: {
  workspaces: Array<{
    id: string;
    name: string;
    logo: React.ReactNode;
  }>;
  activeWorkspaceId: string | null;
  triggerDetail?: {
    planName: string;
    memberCount: number;
  } | null;
}) {
  const sharingIcon =
    triggerDetail && triggerDetail.memberCount > 1 ? (
      <IconUsers
        className="size-4 text-muted-foreground"
        data-testid="workspace-switcher-shared-icon"
        data-icon="users"
      />
    ) : triggerDetail ? (
      <IconLock
        className="size-4 text-muted-foreground"
        data-testid="workspace-switcher-shared-icon"
        data-icon="lock"
      />
    ) : null;

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <SidebarMenuButton
                size="lg"
                className="data-open:bg-sidebar-accent data-open:text-sidebar-accent-foreground"
              />
            }
          >
            <div className="flex aspect-square size-8 items-center justify-center rounded-lg border">
              {activeWorkspace.logo}
            </div>
            <div className="grid flex-1 text-left text-sm leading-tight">
              <span className="truncate font-medium">{activeWorkspace.name}</span>
              {triggerDetail ? (
                <span className="truncate text-xs text-muted-foreground">
                  {triggerDetail.planName}
                </span>
              ) : null}
            </div>
            {sharingIcon}
            <IconSelector className="ml-auto" />
          </DropdownMenuTrigger>
```

- [x] **Step 4: Run the component test again to verify it passes**

Run:

```bash
pnpm --filter @workspace/web test test/unit/components/workspace-switcher.test.tsx
```

Expected: PASS with the new subtitle and icon tests green while the existing dropdown tests still pass.

- [x] **Step 5: Commit the trigger rendering change**

```bash
git add apps/web/src/components/workspace-switcher.tsx apps/web/test/unit/components/workspace-switcher.test.tsx
git commit -m "feat(workspace): add trigger plan and sharing indicators"
```

### Task 3: Wire trigger details through `AppSidebar`

**Files:**

- Modify: `apps/web/src/components/app-sidebar.tsx`
- Modify: `apps/web/test/unit/components/app-sidebar.test.tsx`

- [x] **Step 1: Write the failing sidebar wiring tests**

```ts
const { useWorkspaceSwitcherTriggerDetailQueryMock } = vi.hoisted(() => ({
  useWorkspaceSwitcherTriggerDetailQueryMock: vi.fn(),
}));

vi.mock('@/workspace/workspace.queries', () => ({
  useWorkspaceListQuery: useWorkspaceListQueryMock,
  useWorkspaceDetailQuery: useWorkspaceDetailQueryMock,
  useWorkspaceSwitcherTriggerDetailQuery:
    useWorkspaceSwitcherTriggerDetailQueryMock,
}));

vi.mock('@/components/workspace-switcher', () => ({
  WorkspaceSwitcher: ({
    triggerDetail,
  }: {
    triggerDetail?: { planName: string; memberCount: number } | null;
  }) => (
    <div
      data-testid="workspace-switcher"
      data-plan-name={triggerDetail?.planName ?? ''}
      data-member-count={String(triggerDetail?.memberCount ?? '')}
    />
  ),
}));

it('passes active workspace trigger detail into WorkspaceSwitcher', async () => {
  useWorkspaceSwitcherTriggerDetailQueryMock.mockReturnValue({
    data: { planName: 'Pro', memberCount: 2 },
  });

  render(<AppSidebar />);

  expect(screen.getByTestId('workspace-switcher')).toHaveAttribute(
    'data-plan-name',
    'Pro'
  );
  expect(screen.getByTestId('workspace-switcher')).toHaveAttribute(
    'data-member-count',
    '2'
  );
});

it('passes null trigger detail when the query has not resolved yet', async () => {
  useWorkspaceSwitcherTriggerDetailQueryMock.mockReturnValue({ data: undefined });

  render(<AppSidebar />);

  expect(screen.getByTestId('workspace-switcher')).toHaveAttribute(
    'data-plan-name',
    ''
  );
});
```

- [x] **Step 2: Run the sidebar test to verify it fails**

Run:

```bash
pnpm --filter @workspace/web test test/unit/components/app-sidebar.test.tsx
```

Expected: FAIL because `AppSidebar` does not request or pass trigger details yet.

- [x] **Step 3: Wire the new query into `AppSidebar`**

```tsx
import {
  useWorkspaceDetailQuery,
  useWorkspaceListQuery,
  useWorkspaceSwitcherTriggerDetailQuery,
} from '@/workspace/workspace.queries';

const { data: triggerDetail } =
  useWorkspaceSwitcherTriggerDetailQuery(activeWorkspaceId);

<WorkspaceSwitcher
  workspaces={workspaces}
  activeWorkspaceId={activeWorkspaceId}
  triggerDetail={triggerDetail ?? null}
/>;
```

- [x] **Step 4: Run the sidebar test again to verify it passes**

Run:

```bash
pnpm --filter @workspace/web test test/unit/components/app-sidebar.test.tsx
```

Expected: PASS with active-workspace wiring and fallback coverage green.

- [x] **Step 5: Commit the sidebar wiring**

```bash
git add apps/web/src/components/app-sidebar.tsx apps/web/test/unit/components/app-sidebar.test.tsx
git commit -m "feat(workspace): wire switcher trigger details into sidebar"
```

### Task 4: Add browser coverage and run targeted verification

**Files:**

- Modify: `apps/web/test/e2e/workspace/settings.spec.ts`

- [x] **Step 1: Add the failing E2E assertion**

```ts
test('workspace switcher trigger shows private free workspace details', async ({
  page,
  baseURL,
}) => {
  await signUpAndLogin(page, baseURL!);

  const trigger = page.locator('[data-sidebar="menu-button"]').first();

  await expect(trigger).toContainText('My Workspace');
  await expect(trigger).toContainText('Free');
  await expect(
    trigger.locator(
      '[data-testid="workspace-switcher-shared-icon"][data-icon="lock"]'
    )
  ).toBeVisible();
});
```

- [x] **Step 2: Run the E2E spec to verify it fails**

Run:

```bash
pnpm --filter @workspace/web test:e2e test/e2e/workspace/settings.spec.ts
```

Expected: FAIL because the trigger does not yet show `Free` or the lock icon.

- [x] **Step 3: Run the targeted verification loop after implementation is complete**

Run:

```bash
pnpm --filter @workspace/web test test/unit/workspace/workspace.server.test.ts
pnpm --filter @workspace/web test test/unit/components/workspace-switcher.test.tsx
pnpm --filter @workspace/web test test/unit/components/app-sidebar.test.tsx
pnpm --filter @workspace/web test:e2e test/e2e/workspace/settings.spec.ts
```

Expected:

- Vitest commands PASS
- Playwright PASS with the trigger showing `Free` and the `lock` icon for the default workspace

- [x] **Step 4: Run shared guardrails for the touched area**

Run:

```bash
pnpm run check:boundaries
pnpm --filter @workspace/web typecheck
```

Expected: PASS with no new boundary violations and no TypeScript errors from the new query/prop surface.

- [x] **Step 5: Commit the verification-backed finish**

```bash
git add apps/web/test/e2e/workspace/settings.spec.ts
git commit -m "test(workspace): cover switcher trigger details"
```

## Self-Review

- Spec coverage:
  - Active trigger plan name: covered by Tasks 1-3
  - Active trigger shared/private icon: covered by Tasks 1-3
  - Dropdown rows unchanged: protected by Task 2 existing tests plus Task 3 wiring scope
  - Targeted E2E verification: covered by Task 4
- Placeholder scan:
  - No `TODO`, `TBD`, or “similar to above” shortcuts remain
- Type consistency:
  - `triggerDetail` is consistently `{ planName: string; memberCount: number } | null`
  - Query/hook name is consistently `useWorkspaceSwitcherTriggerDetailQuery`
