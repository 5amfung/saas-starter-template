# SF-22 Design: Remove Temporary Workspace Dynamic Imports In `apps/web`

## Summary

`apps/web/src/workspace/workspace.queries.ts` still uses a temporary dynamic import to load `@/workspace/workspace.functions` inside the workspace detail query function. That workaround existed to avoid import-time failures caused by eager construction of app bootstrap services in `apps/web/src/init.ts`.

PR #68 changed `apps/web/src/init.ts` to expose lazy service getters (`getDb`, `getEmailClient`, `getAuth`) instead of constructing services at module import time. SF-22 removes the remaining temporary workaround in the workspace query path and verifies that the real static import path is now safe in tests.

## Goal

Replace the temporary dynamic import in the `apps/web` workspace query path with a normal static import now that bootstrap services are lazy-loaded.

## Non-Goals

- No further bootstrap architecture changes in `apps/web`.
- No broader cleanup outside the workspace query/mutation path unless required to make the static import safe.
- No behavior changes to workspace data fetching, authorization, or cache key semantics.

## Current State

- `apps/web/src/init.ts` now lazy-loads app services through getter functions.
- `apps/web/src/workspace/workspace.functions.ts` depends on `getAuth()` rather than an eagerly constructed `auth` singleton.
- `apps/web/src/workspace/workspace.queries.ts` still uses `await import('@/workspace/workspace.functions')` in `workspaceDetailQueryOptions`.
- `apps/web/test/unit/workspace/workspace.import-safety.test.ts` currently proves that `@/workspace/workspace.server` can be imported without constructing app services, but it does not yet prove the actual query/server-function path used by the workaround.

## Proposed Change

### 1. Remove The Temporary Dynamic Import

Update `apps/web/src/workspace/workspace.queries.ts` to statically import `getWorkspaceById` at module scope and call it directly from the workspace detail query function.

Expected shape:

- Replace the dynamic `await import()` inside `queryFn`.
- Add a top-level static import for `getWorkspaceById`.

No mutation helper changes are expected because `apps/web/src/workspace/workspace.mutations.ts` is already a pure cache-helper module and does not participate in the bootstrap chain.

### 2. Strengthen Import-Safety Coverage

Update the workspace import-safety test so it validates the real modules that matter for SF-22:

- `@/workspace/workspace.functions`
- `@/workspace/workspace.queries`

The test should continue to remove a representative env var such as `RESEND_API_KEY`, reset modules, and then verify those imports resolve successfully. This proves that static importing the workspace query/server-function chain no longer triggers env-dependent startup failures.

### 3. Keep Existing Behavioral Tests Intact

Existing workspace function tests that intentionally mock `@/init` should remain in place. Those tests verify runtime behavior and are still useful even after import safety is fixed.

The new or updated import-safety test should complement those tests by covering module-load behavior through the real import path without additional `@/init` mocks.

## Why This Approach

This is the smallest change that satisfies SF-22 after PR #68:

- It removes the workaround from the exact module named in the issue.
- It relies on the already-landed lazy bootstrap refactor rather than reopening bootstrap design.
- It proves the fix with a regression test aimed at the real import boundary that was previously unsafe.

## Alternatives Considered

### Keep The Dynamic Import

Rejected because it preserves a workaround after the root cause has already been addressed by PR #68.

### Broader `apps/web` Cleanup Sweep

Deferred because SF-22 is specifically about the workspace query/mutation path. A broader sweep may be worthwhile later, but it is not needed to satisfy this issue.

## Risks

- If any remaining import-time side effect still exists in the workspace server-function path, switching back to a static import will fail immediately in the import-safety test.
- If the test only imports low-level workspace server helpers, it could miss a regression in the actual query path. That is why the test target should move up to `workspace.functions` and `workspace.queries`.

## Verification Plan

Run the smallest relevant validation first:

- targeted workspace unit tests covering `workspace.queries`, `workspace.functions`, and workspace import safety

If needed, widen to:

- `pnpm --filter @workspace/web test`

Success criteria:

- `workspace.queries.ts` no longer uses `await import('@/workspace/workspace.functions')`
- static imports of the workspace query/server-function modules succeed without env-dependent startup failures
- existing workspace tests continue to pass with the real import path
