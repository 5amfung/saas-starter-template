# App State Architecture Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Standardize state ownership in `apps/web` so shared server-backed data flows through canonical query modules and route coordination instead of duplicated caches.

**Architecture:** Use TanStack Router for URL state and route coordination, TanStack Query for shared server-backed state, and local/scoped client state only for purely client-side sharing. Migrate incrementally by domain, starting with the workspace shell and workspace detail flows, while preserving the policy capability architecture already on `main`.

**Tech Stack:** TanStack Router, TanStack Query, Better Auth, React 19, Vitest, Playwright, TypeScript

---

## File Structure

### New or expanded architecture units

- Modify: `apps/web/src/hooks/use-workspaces-query.ts`
  - Bridge current shipped workspace list query into the eventual domain-owned model
- Create: `apps/web/src/workspace/workspace.queries.ts`
  - Canonical workspace query keys and query hooks layered on the current shipped workspace shell behavior
- Create: `apps/web/src/workspace/workspace.mutations.ts`
  - Canonical workspace mutation hooks and invalidation contracts
- Create: `apps/web/src/workspace/workspace.selectors.ts`
  - Optional query projection helpers for repeated UI shaping
- Modify: `apps/web/src/components/app-sidebar.tsx`
  - Consume canonical workspace shell query data
- Modify: `apps/web/src/components/workspace-switcher.tsx`
  - Read or invalidate canonical workspace queries on create/switch flows
- Modify: `apps/web/src/routes/_protected/ws/$workspaceId.tsx`
  - Shift loader toward query preloading and route-specific facts
- Modify: `apps/web/src/routes/_protected/ws/$workspaceId/settings.tsx`
  - Use canonical workspace mutation/query path
- Modify: `apps/web/src/routes/_protected/ws/$workspaceId/members.tsx`
  - Migrate route reads to canonical query shape where applicable
- Modify: `apps/web/src/routes/_protected/ws/$workspaceId/billing.tsx`
  - Ensure billing state composes cleanly with canonical workspace state
- Test: `apps/web/test/unit/workspace/workspace.queries.test.ts`
- Test: `apps/web/test/unit/workspace/workspace.mutations.test.ts`
- Test: `apps/web/test/unit/components/app-sidebar.test.tsx`
- Test: `apps/web/test/e2e/workspace/settings.spec.ts`

### Follow-on domains

- Create: `apps/web/src/account/account.queries.ts`
- Create: `apps/web/src/account/account.mutations.ts`
- Create: `apps/web/src/billing/billing.queries.ts`
- Create: `apps/web/src/members/members.queries.ts`

These follow-on files are deferred until the workspace migration is stable.

## Task 1: Formalize workspace query ownership

**Files:**

- Modify: `apps/web/src/hooks/use-workspaces-query.ts`
- Create: `apps/web/src/workspace/workspace.queries.ts`
- Test: `apps/web/test/unit/workspace/workspace.queries.test.ts`

- [x] **Step 1: Write the failing unit tests for canonical workspace query keys and data normalization**

```ts
// apps/web/test/unit/workspace/workspace.queries.test.ts
import {
  WORKSPACE_LIST_QUERY_KEY,
  WORKSPACE_DETAIL_QUERY_KEY,
} from '@/workspace/workspace.queries';

describe('workspace query keys', () => {
  it('builds a stable list key', () => {
    expect(WORKSPACE_LIST_QUERY_KEY).toEqual(['workspace', 'list']);
  });

  it('builds a stable detail key', () => {
    expect(WORKSPACE_DETAIL_QUERY_KEY('ws-1')).toEqual([
      'workspace',
      'detail',
      'ws-1',
    ]);
  });
});
```

- [x] **Step 2: Run the unit test to verify it fails**

Run: `pnpm --filter @workspace/web exec vitest run test/unit/workspace/workspace.queries.test.ts`
Expected: FAIL because `workspace.queries.ts` does not exist yet.

- [x] **Step 3: Implement the minimal workspace query module**

```ts
// apps/web/src/workspace/workspace.queries.ts
import { useQuery } from '@tanstack/react-query';
import { authClient } from '@workspace/auth/client';

export const WORKSPACE_LIST_QUERY_KEY = ['workspace', 'list'] as const;
export const WORKSPACE_DETAIL_QUERY_KEY = (workspaceId: string) =>
  ['workspace', 'detail', workspaceId] as const;

export function useWorkspaceListQuery() {
  return useQuery({
    queryKey: WORKSPACE_LIST_QUERY_KEY,
    queryFn: async () => {
      const { data, error } = await authClient.organization.list();
      if (error) throw new Error(error.message);
      return data;
    },
  });
}
```

```ts
// apps/web/src/hooks/use-workspaces-query.ts
// Keep this file as a compatibility bridge during migration.
export {
  WORKSPACE_LIST_QUERY_KEY as WORKSPACES_QUERY_KEY,
  useWorkspaceListQuery as useWorkspacesQuery,
} from '@/workspace/workspace.queries';
```

- [x] **Step 4: Run the unit test to verify it passes**

Run: `pnpm --filter @workspace/web exec vitest run test/unit/workspace/workspace.queries.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/workspace/workspace.queries.ts apps/web/test/unit/workspace/workspace.queries.test.ts
git commit -m "refactor(web): add canonical workspace query module"
```

## Task 2: Standardize workspace mutation invalidation

**Files:**

- Create: `apps/web/src/workspace/workspace.mutations.ts`
- Modify: `apps/web/src/hooks/use-workspaces-query.ts`
- Modify: `apps/web/src/routes/_protected/ws/$workspaceId/settings.tsx`
- Test: `apps/web/test/unit/workspace/workspace.mutations.test.ts`

- [ ] **Step 1: Write the failing mutation invalidation test**

```ts
// apps/web/test/unit/workspace/workspace.mutations.test.ts
import { WORKSPACE_LIST_QUERY_KEY } from '@/workspace/workspace.queries';
import { renameWorkspaceInList } from '@/workspace/workspace.mutations';

describe('workspace mutation cache helpers', () => {
  it('renames only the matching workspace in cached list data', () => {
    const input = [
      { id: 'ws-1', name: 'One' },
      { id: 'ws-2', name: 'Two' },
    ];

    expect(renameWorkspaceInList(input, 'ws-2', 'Renamed')).toEqual([
      { id: 'ws-1', name: 'One' },
      { id: 'ws-2', name: 'Renamed' },
    ]);
  });

  it('keeps the canonical list key available to mutation contracts', () => {
    expect(WORKSPACE_LIST_QUERY_KEY).toEqual(['workspace', 'list']);
  });
});
```

- [ ] **Step 2: Run the unit test to verify it fails**

Run: `pnpm --filter @workspace/web exec vitest run test/unit/workspace/workspace.mutations.test.ts`
Expected: FAIL because `workspace.mutations.ts` does not exist yet.

- [ ] **Step 3: Implement the minimal mutation helper module**

```ts
// apps/web/src/workspace/workspace.mutations.ts
export function renameWorkspaceInList<T extends { id: string; name: string }>(
  workspaces: Array<T> | undefined,
  workspaceId: string,
  nextName: string
) {
  if (!workspaces) return workspaces;

  return workspaces.map((workspace) =>
    workspace.id === workspaceId ? { ...workspace, name: nextName } : workspace
  );
}
```

```ts
// apps/web/src/hooks/use-workspaces-query.ts
export { renameWorkspaceInList } from '@/workspace/workspace.mutations';
```

- [ ] **Step 4: Update the settings route to use the canonical mutation/query contract**

```ts
// apps/web/src/routes/_protected/ws/$workspaceId/settings.tsx
const queryClient = useQueryClient();
const router = useRouter();

const updateMutation = useMutation({
  mutationFn: async (name: string) => {
    await updateWorkspaceSettings({
      data: { workspaceId, name },
    });
  },
  onSuccess: async (_data, nextName) => {
    queryClient.setQueryData(WORKSPACE_LIST_QUERY_KEY, (previous) =>
      renameWorkspaceInList(previous, workspaceId, nextName)
    );

    await Promise.all([
      queryClient.invalidateQueries({ queryKey: WORKSPACE_LIST_QUERY_KEY }),
      router.invalidate({ sync: true }),
    ]);
  },
});
```

- [ ] **Step 5: Run the unit test to verify it passes**

Run: `pnpm --filter @workspace/web exec vitest run test/unit/workspace/workspace.mutations.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/workspace/workspace.mutations.ts apps/web/src/routes/_protected/ws/$workspaceId/settings.tsx apps/web/test/unit/workspace/workspace.mutations.test.ts
git commit -m "fix(web): standardize workspace mutation invalidation"
```

## Task 3: Move shell consumers onto canonical workspace queries

**Files:**

- Modify: `apps/web/src/components/app-sidebar.tsx`
- Modify: `apps/web/src/components/workspace-switcher.tsx`
- Test: `apps/web/test/unit/components/app-sidebar.test.tsx`

- [ ] **Step 1: Write the failing shell-consumer test**

```ts
it('prefers the route workspace and canonical workspace list for shell state', async () => {
  useWorkspacesQueryMock.mockReturnValue({
    data: [
      { id: 'ws-1', name: 'One' },
      { id: 'ws-2', name: 'Two' },
    ],
  });

  useActiveOrganizationMock.mockReturnValue({
    data: { id: 'ws-2', name: 'Two' },
  });

  useRouterStateMock.mockImplementation(({ select }) =>
    select({ location: { pathname: '/ws/ws-1/overview' } })
  );

  render(<AppSidebar />);

  expect(screen.getByTestId('workspace-switcher')).toHaveAttribute(
    'data-active-id',
    'ws-1'
  );
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter @workspace/web exec vitest run test/unit/components/app-sidebar.test.tsx`
Expected: FAIL if shell consumers still depend on non-canonical workspace reads.

- [ ] **Step 3: Update shell consumers to use canonical workspace queries**

```ts
// apps/web/src/components/app-sidebar.tsx
const { data: organizations } = useWorkspaceListQuery();
const { data: activeOrganization } = authClient.useActiveOrganization();
```

```ts
// apps/web/src/components/workspace-switcher.tsx
// Ensure create/set-active flows invalidate canonical workspace queries
await queryClient.invalidateQueries({ queryKey: WORKSPACE_LIST_QUERY_KEY });
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm --filter @workspace/web exec vitest run test/unit/components/app-sidebar.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/app-sidebar.tsx apps/web/src/components/workspace-switcher.tsx apps/web/test/unit/components/app-sidebar.test.tsx
git commit -m "refactor(web): move workspace shell onto canonical queries"
```

## Task 4: Reduce loader/entity duplication in workspace routes

**Files:**

- Modify: `apps/web/src/routes/_protected/ws/$workspaceId.tsx`
- Modify: `apps/web/src/workspace/workspace.functions.ts`
- Modify: `apps/web/src/workspace/workspace.server.ts`
- Test: `apps/web/test/unit/workspace/workspace.functions.test.ts`

- [ ] **Step 1: Write a failing test for query-first loader coordination**

```ts
it('returns route access facts without becoming the long-lived workspace entity store', async () => {
  const result = await getWorkspaceWithRole({
    data: { workspaceId: 'ws-1' },
  });

  expect(result).toEqual(
    expect.objectContaining({
      workspace: expect.any(Object),
      role: expect.anything(),
    })
  );
});
```

- [ ] **Step 2: Run the unit test to verify current assumptions**

Run: `pnpm --filter @workspace/web exec vitest run test/unit/workspace/workspace.functions.test.ts`
Expected: Use this run to capture the current loader contract before narrowing it.

- [ ] **Step 3: Refactor loader usage toward query preloading**

```ts
// apps/web/src/routes/_protected/ws/$workspaceId.tsx
loader: async ({ context, params }) => {
  await context.queryClient.ensureQueryData(
    workspaceDetailQueryOptions(params.workspaceId)
  );

  return getWorkspaceRouteAccess({
    data: { workspaceId: params.workspaceId },
  });
};
```

- [ ] **Step 4: Run targeted route-function tests**

Run: `pnpm --filter @workspace/web exec vitest run test/unit/workspace/workspace.functions.test.ts`
Expected: PASS with the new narrowed loader role.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/routes/_protected/ws/$workspaceId.tsx apps/web/src/workspace/workspace.functions.ts apps/web/src/workspace/workspace.server.ts apps/web/test/unit/workspace/workspace.functions.test.ts
git commit -m "refactor(web): narrow workspace loader ownership"
```

## Task 5: Add end-to-end regression coverage for shared workspace state propagation

**Files:**

- Modify: `apps/web/test/e2e/workspace/settings.spec.ts`
- Test: `apps/web/test/e2e/workspace/settings.spec.ts`

- [ ] **Step 1: Write the failing e2e regression**

```ts
test('renaming a workspace updates the workspace switcher immediately', async ({
  page,
  baseURL,
}) => {
  await signUpAndLogin(page, baseURL!);
  await goToSettings(page);

  const nameInput = page.getByLabel('Workspace Name');
  const newName = `Renamed WS ${Date.now()}`;

  await nameInput.fill(newName);
  await page.getByRole('button', { name: 'Save' }).click();

  await expect(
    page.locator('[data-sidebar=\"menu-button\"]').first()
  ).toContainText(newName);
});
```

- [ ] **Step 2: Run the e2e test to verify it fails on the old architecture**

Run: `pnpm --filter @workspace/web exec playwright test test/e2e/workspace/settings.spec.ts -g "renaming a workspace updates the workspace switcher immediately" --project=chromium`
Expected: FAIL before the mutation/query ownership fix is in place.

- [ ] **Step 3: Keep the e2e assertion focused on propagation, not unrelated workflow details**

```ts
await openWorkspaceSwitcher(page);
await expect(page.getByRole('menuitem', { name: newName })).toBeVisible();
```

- [ ] **Step 4: Run the e2e test to verify it passes**

Run: `pnpm --filter @workspace/web exec playwright test test/e2e/workspace/settings.spec.ts -g "renaming a workspace updates the workspace switcher immediately" --project=chromium`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/test/e2e/workspace/settings.spec.ts
git commit -m "test(web): cover workspace shell rename propagation"
```

## Task 6: Audit follow-on domains without over-expanding the first migration

**Files:**

- Modify: `docs/superpowers/specs/2026-04-05-app-state-architecture-design.md`
- Modify: `docs/superpowers/plans/2026-04-05-app-state-architecture.md`

- [ ] **Step 1: Record the first migration boundary explicitly**

```md
Phase 1 starts from the shipped workspace shell refresh fix already on `main`
and covers only workspace shell identity plus direct workspace route consumers.
Billing, account, and other shared domains remain on existing patterns until the
workspace migration is stable and verified.
```

- [ ] **Step 2: Run a placeholder scan and consistency check on this plan**

Run: `rg -n "TBD|TODO|implement later|fill in details" docs/superpowers/plans/2026-04-05-app-state-architecture.md docs/superpowers/specs/2026-04-05-app-state-architecture-design.md`
Expected: no matches

- [ ] **Step 3: Commit the finalized docs if they changed**

```bash
git add docs/superpowers/specs/2026-04-05-app-state-architecture-design.md docs/superpowers/plans/2026-04-05-app-state-architecture.md
git commit -m "docs: define app state ownership architecture"
```

## Verification Checklist

- [ ] Run: `pnpm --filter @workspace/web exec vitest run test/unit/workspace/workspace.queries.test.ts test/unit/workspace/workspace.mutations.test.ts test/unit/components/app-sidebar.test.tsx`
- [ ] Run: `pnpm --filter @workspace/web exec tsc --noEmit`
- [ ] Run: `pnpm --filter @workspace/web exec eslint src/components/app-sidebar.tsx src/components/workspace-switcher.tsx 'src/routes/_protected/ws/$workspaceId.tsx' 'src/routes/_protected/ws/$workspaceId/settings.tsx' src/workspace/workspace.queries.ts src/workspace/workspace.mutations.ts test/unit/components/app-sidebar.test.tsx test/unit/workspace/workspace.queries.test.ts test/unit/workspace/workspace.mutations.test.ts test/e2e/workspace/settings.spec.ts`
- [ ] Run: `pnpm --filter @workspace/web exec playwright test test/e2e/workspace/settings.spec.ts -g "renaming a workspace updates the workspace switcher immediately" --project=chromium`
      Expected: run outside the Codex sandbox because Playwright browser execution is sandbox-constrained here.

## Self-Review

Spec coverage:

- workspace identity ownership: covered in Tasks 1-3
- loader/query coordination: covered in Task 4
- regression coverage: covered in Task 5
- bounded rollout: covered in Task 6

Placeholder scan:

- no `TBD`, `TODO`, or deferred implementation placeholders remain in the plan body

Type consistency:

- canonical workspace query key naming is consistent across Tasks 1-5
- canonical mutation helper naming is consistent across Tasks 2 and 5

Plan complete and saved to `docs/superpowers/plans/2026-04-05-app-state-architecture.md`. Two execution options:

1. Subagent-Driven (recommended) - I dispatch a fresh subagent per task, review between tasks, fast iteration

2. Inline Execution - Execute tasks in this session using executing-plans, batch execution with checkpoints

Which approach?
