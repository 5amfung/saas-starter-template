# SF-22 Workspace Static Imports Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the temporary dynamic import from the `apps/web` workspace detail query path and prove that the real static import chain is safe after the lazy bootstrap refactor.

**Architecture:** Keep the bootstrap layer unchanged and rely on the lazy `getAuth()` service boundary already introduced in `apps/web/src/init.ts`. Make the smallest possible code change in the workspace query module, then strengthen the existing import-safety regression test so it covers the modules that previously required the workaround.

**Tech Stack:** TypeScript, TanStack Query, TanStack Start server functions, Vitest, pnpm

---

## File Structure

- Modify: `apps/web/src/workspace/workspace.queries.ts`
  Responsibility: workspace React Query options and hooks used by the web app.
- Modify: `apps/web/test/unit/workspace/workspace.import-safety.test.ts`
  Responsibility: regression coverage that importing workspace modules does not eagerly construct env-dependent app services.
- Verify only: `apps/web/test/unit/workspace/workspace.queries.test.ts`
  Responsibility: existing lightweight query-key coverage that should continue to pass after the import change.

### Task 1: Strengthen Import-Safety Regression Coverage

**Files:**

- Modify: `apps/web/test/unit/workspace/workspace.import-safety.test.ts`
- Verify: `apps/web/src/workspace/workspace.functions.ts`
- Verify: `apps/web/src/workspace/workspace.queries.ts`

- [ ] **Step 1: Replace the current single-module import-safety test with coverage for the real workspace query path**

Update `apps/web/test/unit/workspace/workspace.import-safety.test.ts` to this shape:

```ts
describe('workspace import safety', () => {
  it('imports workspace server-function modules without constructing app services', async () => {
    const previousApiKey = process.env.RESEND_API_KEY;
    delete process.env.RESEND_API_KEY;

    try {
      vi.resetModules();

      await expect(
        import('@/workspace/workspace.functions')
      ).resolves.toBeDefined();
      await expect(
        import('@/workspace/workspace.queries')
      ).resolves.toBeDefined();
    } finally {
      if (previousApiKey === undefined) {
        delete process.env.RESEND_API_KEY;
      } else {
        process.env.RESEND_API_KEY = previousApiKey;
      }
    }
  });
});
```

- [ ] **Step 2: Run the import-safety test before touching application code**

Run:

```bash
pnpm --filter @workspace/web test test/unit/workspace/workspace.import-safety.test.ts
```

Expected:

- PASS on the rebased `main` baseline, because `apps/web/src/init.ts` now lazy-loads services.
- The test should succeed even before the dynamic import is removed, confirming that the bootstrap precondition from PR #68 is already in place.

- [ ] **Step 3: Commit the test-only checkpoint if working in small commits**

```bash
git add apps/web/test/unit/workspace/workspace.import-safety.test.ts
git commit -m "test(web): strengthen workspace import safety coverage"
```

### Task 2: Remove The Temporary Dynamic Import

**Files:**

- Modify: `apps/web/src/workspace/workspace.queries.ts`
- Verify: `apps/web/src/workspace/workspace.functions.ts`
- Test: `apps/web/test/unit/workspace/workspace.queries.test.ts`

- [ ] **Step 1: Write the intended static-import shape**

Update `apps/web/src/workspace/workspace.queries.ts` so it matches this structure:

```ts
import { queryOptions, useQuery } from '@tanstack/react-query';
import { authClient } from '@workspace/auth/client';
import { getWorkspaceById } from '@/workspace/workspace.functions';

type WorkspaceSummary = {
  id: string;
  name: string;
  slug: string;
  createdAt: Date;
  logo?: string | null;
  metadata?: unknown;
};

export const WORKSPACE_LIST_QUERY_KEY = ['workspace', 'list'] as const;
export const WORKSPACE_DETAIL_QUERY_KEY = (workspaceId: string) =>
  ['workspace', 'detail', workspaceId] as const;

export function workspaceDetailQueryOptions(workspaceId: string) {
  return queryOptions({
    queryKey: WORKSPACE_DETAIL_QUERY_KEY(workspaceId),
    queryFn: () => getWorkspaceById({ data: { workspaceId } }),
  });
}
```

Keep the rest of the file unchanged.

- [ ] **Step 2: Verify the workaround is gone by searching for the old import pattern**

Run:

```bash
rg -n "await import\\('@/workspace/workspace.functions'\\)" apps/web/src/workspace/workspace.queries.ts
```

Expected:

- No output.

- [ ] **Step 3: Run the focused workspace query tests**

Run:

```bash
pnpm --filter @workspace/web test test/unit/workspace/workspace.queries.test.ts
```

Expected:

- PASS with the same stable query-key assertions as before.

- [ ] **Step 4: Re-run the import-safety test against the new static import chain**

Run:

```bash
pnpm --filter @workspace/web test test/unit/workspace/workspace.import-safety.test.ts
```

Expected:

- PASS while importing `@/workspace/workspace.functions` and `@/workspace/workspace.queries` without env-dependent startup failures.

- [ ] **Step 5: Commit the functional change**

```bash
git add apps/web/src/workspace/workspace.queries.ts apps/web/test/unit/workspace/workspace.import-safety.test.ts
git commit -m "refactor(web): remove workspace query dynamic import workaround"
```

### Task 3: Final Verification

**Files:**

- Verify: `apps/web/test/unit/workspace/workspace.functions.test.ts`
- Verify: `apps/web/test/unit/workspace/workspace.queries.test.ts`
- Verify: `apps/web/test/unit/workspace/workspace.import-safety.test.ts`

- [ ] **Step 1: Run the focused workspace unit suite**

Run:

```bash
pnpm --filter @workspace/web test test/unit/workspace/workspace.functions.test.ts test/unit/workspace/workspace.queries.test.ts test/unit/workspace/workspace.import-safety.test.ts
```

Expected:

- PASS for all three test files.

- [ ] **Step 2: Capture the final diff for review**

Run:

```bash
git diff -- apps/web/src/workspace/workspace.queries.ts apps/web/test/unit/workspace/workspace.import-safety.test.ts
```

Expected:

- `workspace.queries.ts` shows a top-level static import of `getWorkspaceById`.
- `workspace.import-safety.test.ts` imports `workspace.functions` and `workspace.queries` instead of only `workspace.server`.

- [ ] **Step 3: Commit the final verified state if previous checkpoints were skipped**

```bash
git add apps/web/src/workspace/workspace.queries.ts apps/web/test/unit/workspace/workspace.import-safety.test.ts
git commit -m "refactor(web): remove workspace query dynamic import workaround"
```

## Self-Review

### Spec Coverage

- Remove dynamic import from the workspace query path: covered in Task 2.
- Prove static import safety through tests: covered in Task 1 and Task 2.
- Preserve existing behavior tests: covered in Task 3 verification.

### Placeholder Scan

- No `TODO` or `TBD` markers.
- Every task includes exact files, commands, and expected outcomes.

### Type Consistency

- The plan consistently targets `getWorkspaceById`, `workspace.queries.ts`, and `workspace.import-safety.test.ts`.
- The static import shape matches the existing exported symbol names in `apps/web/src/workspace/workspace.functions.ts`.
