# Standardize Settings Data Fetching Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Consolidate five data fetching patterns in workspace settings into three consistent patterns (loader, useQuery hook, Better Auth reactive hook).

**Architecture:** Promote member role into the parent route loader (`$workspaceId.tsx`) via a new server function. Extract shared `useActiveMemberRoleQuery` and `useBillingDataQuery` hooks. Remove all manual `useEffect`+`useState` fetch patterns.

**Tech Stack:** TanStack Router (loader, staleTime), TanStack Query (useQuery), Better Auth server API (`getFullOrganization`), Vitest + Testing Library.

---

### Task 1: Add Server-Side Role Lookup Helper

**Files:**

- Modify: `apps/web/src/workspace/workspace.server.ts`

- [ ] **Step 1: Add `getActiveMemberRole` to workspace.server.ts**

Add a function that fetches the user's role for a given workspace server-side using `auth.api.getFullOrganization`. Place it after the existing `ensureWorkspaceMembership` function.

```ts
export async function getActiveMemberRole(
  headers: Headers,
  workspaceId: string,
  userId: string
): Promise<string | null> {
  const organization = await auth.api.getFullOrganization({
    headers,
    query: { organizationId: workspaceId },
  });
  if (!organization) return null;

  const member = organization.members.find((m) => m.userId === userId);
  return member?.role ?? null;
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/workspace/workspace.server.ts
git commit -m "feat(workspace): add server-side getActiveMemberRole helper"
```

---

### Task 2: Create `getWorkspaceWithRole` Server Function

**Files:**

- Modify: `apps/web/src/workspace/workspace.functions.ts`

- [ ] **Step 1: Add `getWorkspaceWithRole` server function**

This function fetches workspace + role in parallel. Add it after the existing `getWorkspaceById` export. Reuse the existing `resolveWorkspaceRouteAccess` for workspace and the new `getActiveMemberRole` for the role.

Import `getActiveMemberRole` at the top alongside the existing import:

```ts
import {
  ensureActiveWorkspaceForSession,
  ensureWorkspaceMembership,
  getActiveMemberRole,
} from '@/workspace/workspace.server';
```

Add the new server function:

```ts
export const getWorkspaceWithRole = createServerFn()
  .inputValidator(workspaceRouteInput)
  .handler(async ({ data }) => {
    const headers = getRequestHeaders();
    const session = await auth.api.getSession({ headers });
    if (!session || !session.user.emailVerified) {
      throw redirect({ to: '/signin' });
    }

    const [workspace, role] = await Promise.all([
      resolveWorkspaceRouteAccess(data.workspaceId),
      getActiveMemberRole(headers, data.workspaceId, session.user.id),
    ]);

    return { workspace, role };
  });
```

Note: `resolveWorkspaceRouteAccess` already calls `getSession` internally, so there's a redundant session check. However, we need the `session.user.id` for the role lookup. The double session call is cheap (same request context) and avoids refactoring `resolveWorkspaceRouteAccess`'s return type.

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/workspace/workspace.functions.ts
git commit -m "feat(workspace): add getWorkspaceWithRole server function"
```

---

### Task 3: Update Parent Route Loader

**Files:**

- Modify: `apps/web/src/routes/_protected/ws/$workspaceId.tsx`

- [ ] **Step 1: Switch loader to use `getWorkspaceWithRole`**

Replace the full file content. The key changes: import `getWorkspaceWithRole` instead of `getWorkspaceById`, update the loader to call the new function, add `staleTime: 30_000`.

Update the import:

```ts
import { getWorkspaceWithRole } from '@/workspace/workspace.functions';
```

Remove the old import:

```ts
// DELETE: import { getWorkspaceById } from '@/workspace/workspace.functions';
```

Replace the Route definition:

```ts
export const Route = createFileRoute('/_protected/ws/$workspaceId')({
  component: WorkspaceLayout,
  staleTime: 30_000,
  loader: async ({ params }) => {
    try {
      return await getWorkspaceWithRole({
        data: { workspaceId: params.workspaceId },
      });
    } catch (error) {
      if (isWorkspaceNotFoundError(error)) {
        throw notFound({ routeId: '__root__' });
      }
      throw error;
    }
  },
});
```

- [ ] **Step 2: Run typecheck to identify all broken `useLoaderData()` call sites**

Run: `pnpm run typecheck`

Expected: Only `apps/web/src/routes/_protected/ws/$workspaceId/settings.tsx` should fail (line 63), because it accesses `workspace.name` directly on what is now `{ workspace, role }`. The other child routes (overview, members, billing, projects) do not call `useLoaderData()` on the parent, so they should be clean.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/routes/_protected/ws/$workspaceId.tsx
git commit -m "feat(workspace): promote role to parent route loader with staleTime"
```

---

### Task 4: Create `useActiveMemberRoleQuery` Hook

**Files:**

- Create: `apps/web/src/hooks/use-active-member-role-query.ts`
- Test: `apps/web/test/unit/hooks/use-active-member-role-query.test.ts`

- [ ] **Step 1: Write the test file**

```ts
// @vitest-environment jsdom
import { renderHook, waitFor } from '@testing-library/react';
import { createHookWrapper } from '@workspace/test-utils';
import { useActiveMemberRoleQuery } from '@/hooks/use-active-member-role-query';

const { getActiveMemberRoleMock } = vi.hoisted(() => ({
  getActiveMemberRoleMock: vi.fn(),
}));

vi.mock('@workspace/auth/client', () => ({
  authClient: {
    organization: {
      getActiveMemberRole: getActiveMemberRoleMock,
    },
  },
}));

describe('useActiveMemberRoleQuery', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns role when fetch succeeds', async () => {
    getActiveMemberRoleMock.mockResolvedValue({
      data: { role: 'owner' },
      error: null,
    });

    const { result } = renderHook(() => useActiveMemberRoleQuery('ws-1'), {
      wrapper: createHookWrapper(),
    });

    await waitFor(() => {
      expect(result.current.data).toBe('owner');
    });
  });

  it('returns null when fetch errors', async () => {
    getActiveMemberRoleMock.mockResolvedValue({
      data: null,
      error: { message: 'Unauthorized' },
    });

    const { result } = renderHook(() => useActiveMemberRoleQuery('ws-1'), {
      wrapper: createHookWrapper(),
    });

    await waitFor(() => {
      expect(result.current.data).toBeNull();
    });
  });

  it('does not fetch when workspaceId is null', () => {
    getActiveMemberRoleMock.mockResolvedValue({
      data: { role: 'owner' },
      error: null,
    });

    renderHook(() => useActiveMemberRoleQuery(null), {
      wrapper: createHookWrapper(),
    });

    expect(getActiveMemberRoleMock).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @workspace/web test test/unit/hooks/use-active-member-role-query.test.ts`

Expected: FAIL — module `@/hooks/use-active-member-role-query` does not exist.

- [ ] **Step 3: Create the hook**

```ts
import { useQuery } from '@tanstack/react-query';
import { authClient } from '@workspace/auth/client';

export const ACTIVE_MEMBER_ROLE_QUERY_KEY = (workspaceId: string) =>
  ['workspace', 'activeRole', workspaceId] as const;

export function useActiveMemberRoleQuery(workspaceId: string | null) {
  return useQuery({
    queryKey: ACTIVE_MEMBER_ROLE_QUERY_KEY(workspaceId!),
    queryFn: async () => {
      const { data, error } =
        await authClient.organization.getActiveMemberRole();
      if (error) return null;
      return typeof data.role === 'string' ? data.role : null;
    },
    enabled: !!workspaceId,
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @workspace/web test test/unit/hooks/use-active-member-role-query.test.ts`

Expected: PASS — all 3 tests.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/hooks/use-active-member-role-query.ts apps/web/test/unit/hooks/use-active-member-role-query.test.ts
git commit -m "feat(hooks): add useActiveMemberRoleQuery shared hook"
```

---

### Task 5: Create `useBillingDataQuery` Hook

**Files:**

- Create: `apps/web/src/billing/use-billing-data-query.ts`
- Test: `apps/web/test/unit/billing/use-billing-data-query.test.ts`

- [ ] **Step 1: Write the test file**

```ts
// @vitest-environment jsdom
import { renderHook, waitFor } from '@testing-library/react';
import { createHookWrapper } from '@workspace/test-utils';
import {
  BILLING_DATA_QUERY_KEY,
  useBillingDataQuery,
} from '@/billing/use-billing-data-query';

const { getWorkspaceBillingDataMock } = vi.hoisted(() => ({
  getWorkspaceBillingDataMock: vi.fn(),
}));

vi.mock('@/billing/billing.functions', () => ({
  getWorkspaceBillingData: getWorkspaceBillingDataMock,
}));

const WORKSPACE_ID = 'ws-1';

describe('useBillingDataQuery', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetches billing data for the workspace', async () => {
    const mockData = { planId: 'pro', subscription: { status: 'active' } };
    getWorkspaceBillingDataMock.mockResolvedValue(mockData);

    const { result } = renderHook(() => useBillingDataQuery(WORKSPACE_ID), {
      wrapper: createHookWrapper(),
    });

    await waitFor(() => {
      expect(result.current.data).toEqual(mockData);
    });

    expect(getWorkspaceBillingDataMock).toHaveBeenCalledWith({
      data: { workspaceId: WORKSPACE_ID },
    });
  });

  it('does not fetch when enabled is false', () => {
    renderHook(() => useBillingDataQuery(WORKSPACE_ID, false), {
      wrapper: createHookWrapper(),
    });

    expect(getWorkspaceBillingDataMock).not.toHaveBeenCalled();
  });

  it('exports correct query key factory', () => {
    expect(BILLING_DATA_QUERY_KEY(WORKSPACE_ID)).toEqual([
      'billing',
      'data',
      'ws-1',
    ]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @workspace/web test test/unit/billing/use-billing-data-query.test.ts`

Expected: FAIL — module `@/billing/use-billing-data-query` does not exist.

- [ ] **Step 3: Create the hook**

```ts
import { useQuery } from '@tanstack/react-query';
import { getWorkspaceBillingData } from '@/billing/billing.functions';

export const BILLING_DATA_QUERY_KEY = (workspaceId: string) =>
  ['billing', 'data', workspaceId] as const;

export function useBillingDataQuery(workspaceId: string, enabled = true) {
  return useQuery({
    queryKey: BILLING_DATA_QUERY_KEY(workspaceId),
    queryFn: () => getWorkspaceBillingData({ data: { workspaceId } }),
    enabled,
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @workspace/web test test/unit/billing/use-billing-data-query.test.ts`

Expected: PASS — all 3 tests.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/billing/use-billing-data-query.ts apps/web/test/unit/billing/use-billing-data-query.test.ts
git commit -m "feat(billing): add useBillingDataQuery shared hook"
```

---

### Task 6: Refactor `settings.tsx` to Use Loader Role + Billing Hook

**Files:**

- Modify: `apps/web/src/routes/_protected/ws/$workspaceId/settings.tsx`

- [ ] **Step 1: Update imports**

Remove these imports (no longer needed):

```ts
// DELETE: import { useQuery } from '@tanstack/react-query';
// DELETE: import { getWorkspaceBillingData } from '@/billing/billing.functions';
```

Add this import:

```ts
import { useBillingDataQuery } from '@/billing/use-billing-data-query';
```

Also update the `@tanstack/react-query` import to only keep `useMutation`:

```ts
import { useMutation } from '@tanstack/react-query';
```

- [ ] **Step 2: Update `useLoaderData` destructuring**

Replace line 63:

```ts
// BEFORE:
const workspace = workspaceRouteApi.useLoaderData();

// AFTER:
const { workspace, role } = workspaceRouteApi.useLoaderData();
```

- [ ] **Step 3: Remove the manual role fetch**

Delete the entire `useState` + `useEffect` block (lines 66-81) and the `hasOwnerRole` helper function (lines 38-43).

Replace the `isOwner` derivation:

```ts
// BEFORE:
const isOwner = hasOwnerRole(activeRole);

// AFTER:
const isOwner = role === 'owner';
```

- [ ] **Step 4: Replace inline billing query with hook**

Replace lines 85-89:

```ts
// BEFORE:
const billingQuery = useQuery({
  queryKey: ['billing', 'data', workspaceId],
  queryFn: () => getWorkspaceBillingData({ data: { workspaceId } }),
  enabled: isOwner,
});

// AFTER:
const billingQuery = useBillingDataQuery(workspaceId, isOwner);
```

- [ ] **Step 5: Remove unused React import if needed**

After removing `useState` and the role-related `useEffect`, check if `React.useState` and `React.useEffect` are still used. They are — for `initialWorkspaceName` state and the `useCallback`. The `import * as React` stays.

- [ ] **Step 6: Run typecheck**

Run: `pnpm run typecheck`

Expected: PASS — no type errors.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/routes/_protected/ws/$workspaceId/settings.tsx
git commit -m "refactor(settings): use loader role and useBillingDataQuery hook"
```

---

### Task 7: Refactor `app-sidebar.tsx` to Use `useActiveMemberRoleQuery`

**Files:**

- Modify: `apps/web/src/components/app-sidebar.tsx`
- Modify: `apps/web/test/unit/components/app-sidebar.test.tsx`

- [ ] **Step 1: Update `app-sidebar.tsx`**

Add the import:

```ts
import { useActiveMemberRoleQuery } from '@/hooks/use-active-member-role-query';
```

Replace the `useState` + `useEffect` block (lines 61-72) with the hook:

```ts
// BEFORE:
const [isWorkspaceOwner, setIsWorkspaceOwner] = React.useState(false);
React.useEffect(() => {
  let mounted = true;
  const loadRole = async () => {
    const result = await authClient.organization.getActiveMemberRole();
    if (mounted) setIsWorkspaceOwner(result.data?.role === 'owner');
  };
  void loadRole();
  return () => {
    mounted = false;
  };
}, [activeWorkspaceId]);

// AFTER:
const { data: activeRole } = useActiveMemberRoleQuery(activeWorkspaceId);
const isWorkspaceOwner = activeRole === 'owner';
```

After this change, `app-sidebar.tsx` no longer calls `authClient.organization.getActiveMemberRole()` directly. Check if `authClient.organization` is still used elsewhere in the file — it is not, so the `authClient` import is still needed for `useSession`, `useListOrganizations`, and `useActiveOrganization`.

- [ ] **Step 2: Update the test file**

The test currently mocks `authClient.organization.getActiveMemberRole` and uses `waitFor` to wait for the `useEffect` to settle. After the refactor, the component uses `useActiveMemberRoleQuery` instead.

Update the hoisted mocks — remove `getActiveMemberRoleMock`, add `useActiveMemberRoleQueryMock`:

```ts
const {
  useSessionMock,
  useListOrganizationsMock,
  useActiveOrganizationMock,
  useActiveMemberRoleQueryMock,
} = vi.hoisted(() => ({
  useSessionMock: vi.fn(),
  useListOrganizationsMock: vi.fn(),
  useActiveOrganizationMock: vi.fn(),
  useActiveMemberRoleQueryMock: vi.fn(),
}));
```

Update the `@workspace/auth/client` mock to remove `organization`:

```ts
vi.mock('@workspace/auth/client', () => ({
  authClient: {
    useSession: useSessionMock,
    useListOrganizations: useListOrganizationsMock,
    useActiveOrganization: useActiveOrganizationMock,
  },
}));
```

Add a new mock for the hook:

```ts
vi.mock('@/hooks/use-active-member-role-query', () => ({
  useActiveMemberRoleQuery: useActiveMemberRoleQueryMock,
}));
```

Update `beforeEach` to set a default return value for the hook mock:

```ts
beforeEach(() => {
  vi.clearAllMocks();
  useActiveMemberRoleQueryMock.mockReturnValue({ data: 'owner' });
});
```

Simplify the `renderSidebar` helper — no longer needs to `waitFor` the async effect:

```ts
async function renderSidebar() {
  render(<AppSidebar />);
}
```

Update the test "renders NavMain with workspace nav items when workspace is active" — it still expects 5 items (Overview, Projects, Members, Billing, Settings) because `isWorkspaceOwner` is true by default. No change needed.

Add a new test for non-owner hiding the Billing link:

```ts
it('hides Billing nav item for non-owner workspace members', async () => {
  useSessionMock.mockReturnValue({ data: mockSession, isPending: false });
  useListOrganizationsMock.mockReturnValue({ data: mockOrgs });
  useActiveOrganizationMock.mockReturnValue({
    data: { id: 'ws-1', name: 'Workspace One' },
  });
  useActiveMemberRoleQueryMock.mockReturnValue({ data: 'member' });

  await renderSidebar();

  // Overview, Projects, Members, Settings = 4 items (no Billing).
  expect(screen.getByTestId('nav-main')).toHaveAttribute(
    'data-item-count',
    '4'
  );
});
```

- [ ] **Step 3: Run tests**

Run: `pnpm --filter @workspace/web test test/unit/components/app-sidebar.test.tsx`

Expected: PASS — all tests including the new non-owner test.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/app-sidebar.tsx apps/web/test/unit/components/app-sidebar.test.tsx
git commit -m "refactor(sidebar): replace useEffect role fetch with useActiveMemberRoleQuery"
```

---

### Task 8: Refactor `use-members-table.ts` to Use Shared Role Hook

**Files:**

- Modify: `apps/web/src/workspace/use-members-table.ts`
- Modify: `apps/web/test/unit/workspace/use-members-table.test.ts`

- [ ] **Step 1: Update `use-members-table.ts`**

Add the import:

```ts
import { useActiveMemberRoleQuery } from '@/hooks/use-active-member-role-query';
```

Replace the inline role query (lines 19-28):

```ts
// BEFORE:
const roleQuery = useQuery({
  queryKey: ['workspace', 'activeRole', workspaceId],
  queryFn: async () => {
    const { data, error } = await authClient.organization.getActiveMemberRole();
    if (error) return null;
    return typeof data.role === 'string' ? data.role : null;
  },
});
const currentUserRole = roleQuery.data ?? null;

// AFTER:
const { data: currentUserRole = null } = useActiveMemberRoleQuery(workspaceId);
```

After this change, `authClient.organization.getActiveMemberRole` is no longer called in this file. Check if `authClient` is still used — yes, for `listMembers`, `leave`, and `removeMember`. The import stays but remove `getActiveMemberRole` from usage.

- [ ] **Step 2: Update the test file**

In the hoisted mocks, remove `getActiveMemberRoleMock`. Add `useActiveMemberRoleQueryMock`:

```ts
const {
  listMembersMock,
  leaveMock,
  removeMemberMock,
  navigateMock,
  mockToastSuccess,
  mockToastError,
  useSessionQueryMock,
  useActiveMemberRoleQueryMock,
} = vi.hoisted(() => ({
  listMembersMock: vi.fn(),
  leaveMock: vi.fn(),
  removeMemberMock: vi.fn(),
  navigateMock: vi.fn(),
  mockToastSuccess: vi.fn(),
  mockToastError: vi.fn(),
  useSessionQueryMock: vi.fn(),
  useActiveMemberRoleQueryMock: vi.fn(),
}));
```

Update the `@workspace/auth/client` mock to remove `getActiveMemberRole`:

```ts
vi.mock('@workspace/auth/client', () => ({
  authClient: {
    organization: {
      listMembers: listMembersMock,
      leave: leaveMock,
      removeMember: removeMemberMock,
    },
  },
}));
```

Add a mock for the hook module:

```ts
vi.mock('@/hooks/use-active-member-role-query', () => ({
  useActiveMemberRoleQuery: useActiveMemberRoleQueryMock,
}));
```

Update `setupDefaults` — replace `getActiveMemberRoleMock` with the hook mock:

```ts
function setupDefaults() {
  useSessionQueryMock.mockReturnValue({ data: mockSession });
  listMembersMock.mockResolvedValue(mockMembersResponse);
  useActiveMemberRoleQueryMock.mockReturnValue({ data: 'owner' });
}
```

The existing test "fetches current user role" (line 118) should still pass — it checks `result.current.currentUserRole === 'owner'`, which now comes from the hook mock.

- [ ] **Step 3: Run tests**

Run: `pnpm --filter @workspace/web test test/unit/workspace/use-members-table.test.ts`

Expected: PASS — all existing tests.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/workspace/use-members-table.ts apps/web/test/unit/workspace/use-members-table.test.ts
git commit -m "refactor(members): replace inline role query with useActiveMemberRoleQuery"
```

---

### Task 9: Refactor `billing-page.tsx` to Use Shared Billing Hook

**Files:**

- Modify: `apps/web/src/components/billing/billing-page.tsx`

- [ ] **Step 1: Update imports**

Add the import:

```ts
import {
  BILLING_DATA_QUERY_KEY,
  useBillingDataQuery,
} from '@/billing/use-billing-data-query';
```

Remove the `getWorkspaceBillingData` import:

```ts
// DELETE: import { getWorkspaceBillingData } from '@/billing/billing.functions';
```

Keep the other billing function imports (`cancelWorkspaceSubscription`, etc.) — they're used by mutations.

Keep `useQuery` in the `@tanstack/react-query` import — it's still used for `invoicesQuery`:

```ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
```

- [ ] **Step 2: Replace inline billing query and key**

Remove the locally-defined query key constants (lines 42-43):

```ts
// DELETE:
const INVOICES_QUERY_KEY = ['billing', 'invoices', workspaceId] as const;
const BILLING_DATA_QUERY_KEY = ['billing', 'data', workspaceId] as const;
```

Add back only the invoices key (not shared yet — only used here):

```ts
const INVOICES_QUERY_KEY = ['billing', 'invoices', workspaceId] as const;
```

Replace the billing `useQuery` call (lines 45-48):

```ts
// BEFORE:
const billingQuery = useQuery({
  queryKey: BILLING_DATA_QUERY_KEY,
  queryFn: () => getWorkspaceBillingData({ data: { workspaceId } }),
});

// AFTER:
const billingQuery = useBillingDataQuery(workspaceId);
```

Update all references to `BILLING_DATA_QUERY_KEY` in invalidation calls. They currently reference the local const — now they should call the imported function:

```ts
// BEFORE (appears in reactivateMutation, downgradeMutation, cancelMutation):
void queryClient.invalidateQueries({ queryKey: BILLING_DATA_QUERY_KEY });

// AFTER:
void queryClient.invalidateQueries({
  queryKey: BILLING_DATA_QUERY_KEY(workspaceId),
});
```

Update `patchBillingCache` which uses `setQueryData` with `BILLING_DATA_QUERY_KEY`:

```ts
// BEFORE:
queryClient.setQueryData<BillingData>(BILLING_DATA_QUERY_KEY, (prev) => {

// AFTER:
queryClient.setQueryData<BillingData>(
  BILLING_DATA_QUERY_KEY(workspaceId),
  (prev) => {
```

- [ ] **Step 3: Run typecheck**

Run: `pnpm run typecheck`

Expected: PASS — the `BILLING_DATA_QUERY_KEY` function returns the same tuple shape as the old const.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/billing/billing-page.tsx
git commit -m "refactor(billing): replace inline billing query with useBillingDataQuery hook"
```

---

### Task 10: Final Verification

**Files:** None — verification only.

- [ ] **Step 1: Run full typecheck**

Run: `pnpm run typecheck`

Expected: PASS — zero errors.

- [ ] **Step 2: Run lint**

Run: `pnpm run lint`

Expected: PASS — no lint errors. If there are unused import warnings, fix them and amend the last commit.

- [ ] **Step 3: Run full test suite**

Run: `pnpm test`

Expected: PASS — all unit and integration tests pass.

- [ ] **Step 4: Verify no remaining manual role fetch patterns**

Search for the old pattern to confirm it's fully removed:

Run: `grep -r "getActiveMemberRole" apps/web/src/ --include="*.ts" --include="*.tsx"`

Expected: Only `apps/web/src/hooks/use-active-member-role-query.ts` should contain this call. No other source files.

- [ ] **Step 5: Commit any lint/typecheck fixes if needed**

```bash
git add -A
git commit -m "chore: fix lint and typecheck issues from refactor"
```

This step is conditional — only run if Steps 1-2 produced errors that required fixes.
