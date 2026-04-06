# Workspace Lifecycle Policy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the first lifecycle-policy slice on top of the shared capability architecture so workspace deletion, owner leave, and owner removal all preserve sane workspace ownership rules.

**Architecture:** Keep the existing access capability model intact, but add a lifecycle-specific policy contract for destructive workspace transitions. `apps/web` loads ownership-aware lifecycle facts, `packages/policy` evaluates lifecycle outcomes, and web server functions enforce the result. Align the implementation with the newer `apps/web` app-state ownership split (`workspace.queries.ts`, `workspace.mutations.ts`, route loaders) and keep post-delete next-workspace resolution intentionally simple.

**Tech Stack:** TypeScript, pnpm workspaces, Turborepo, TanStack Start, Better Auth, ESLint, Dependency Cruiser, Vitest, Playwright

---

## File Structure

### New files

- `docs/superpowers/specs/2026-04-05-workspace-lifecycle-policy-design.md`
- `docs/superpowers/plans/2026-04-05-workspace-lifecycle-policy.md`
- `packages/policy/src/workspace-lifecycle.ts`
- `packages/policy/test/unit/workspace-lifecycle.test.ts`
- `apps/web/src/policy/workspace-lifecycle-capabilities.server.ts`
- `apps/web/test/unit/policy/workspace-lifecycle-capabilities.server.test.ts`
- `apps/web/src/workspace/workspace-members.functions.ts`

### Existing files expected to change

- `packages/policy/src/index.ts`
- `apps/web/src/policy/workspace-capabilities.server.ts`
- `apps/web/src/workspace/workspace.server.ts`
- `apps/web/src/workspace/workspace-settings.functions.ts`
- `apps/web/src/workspace/use-members-table.ts`
- `apps/web/src/components/workspace/workspace-delete-dialog.tsx`
- `apps/web/src/components/workspace/workspace-members-table.tsx`
- `apps/web/src/workspace/workspace.queries.ts`
- `apps/web/src/workspace/workspace.mutations.ts`
- `apps/web/test/unit/components/workspace/workspace-delete-dialog.test.tsx`
- `apps/web/test/unit/workspace/use-members-table.test.ts`
- `apps/web/test/unit/workspace/workspace.mutations.test.ts`
- `apps/web/test/integration/components/workspace/workspace-lifecycle-flow.integration.test.tsx`
- `apps/web/test/e2e/workspace/settings.spec.ts`
- `apps/web/test/e2e/workspace/members.spec.ts`

### Responsibility map

- `packages/policy/src/workspace-lifecycle.ts`
  Owns lifecycle-specific context types, blocked reasons, evaluator, and helper assertions for workspace deletion, leave, and protected member removal.
- `apps/web/src/policy/workspace-lifecycle-capabilities.server.ts`
  Owns ownership-aware fact loading and app-facing lifecycle guards for the web app.
- `apps/web/src/workspace/workspace.server.ts`
  Exposes the lowest correct data access/helper API for counting owned workspaces.
- `apps/web/src/workspace/workspace-settings.functions.ts`
  Enforces lifecycle delete policy and keeps the next-workspace fallback simple.
- `apps/web/src/workspace/workspace-members.functions.ts`
  Enforces lifecycle-aware leave behavior and no-remove-owner behavior from the server side instead of relying on direct client behavior.
- `apps/web/src/workspace/workspace.queries.ts` and `apps/web/src/workspace/workspace.mutations.ts`
  Remain the app-owned client state boundary; update them only as needed to reflect successful lifecycle actions without reintroducing policy logic into UI state helpers.
- tests
  Verify the pure lifecycle evaluator, the web integration layer, and the limbo-state regression scenario end to end.

## Task 1: Introduce the shared lifecycle policy contract

**Files:**

- Create: `packages/policy/src/workspace-lifecycle.ts`
- Create: `packages/policy/test/unit/workspace-lifecycle.test.ts`
- Modify: `packages/policy/src/index.ts`

- [x] **Step 1: Write failing evaluator tests for delete policy**

Cover at least:

- owner with `ownedWorkspaceCount > 1` and no active subscription can delete,
- owner with active subscription cannot delete,
- owner with `ownedWorkspaceCount === 1` cannot delete,
- owner cannot leave,
- no one can remove an owner,
- admin/member cannot delete,
- blocked reasons are returned correctly.

- [x] **Step 2: Implement the lifecycle evaluator**

Add a pure evaluator with a contract similar to:

```ts
interface WorkspaceLifecyclePolicyContext {
  actorWorkspaceRole: WorkspaceRole | null;
  ownedWorkspaceCount: number;
  hasActiveSubscription: boolean;
}

interface WorkspaceLifecycleCapabilities {
  canDeleteWorkspace: boolean;
  deleteWorkspaceBlockedReason:
    | 'not-owner'
    | 'active-subscription'
    | 'last-personal-workspace'
    | null;
  canLeaveWorkspace: boolean;
  leaveWorkspaceBlockedReason: 'owner-cannot-leave' | null;
  canRemoveMember: boolean;
  removeMemberBlockedReason:
    | 'cannot-remove-owner'
    | 'cannot-remove-self'
    | null;
}
```

- [x] **Step 3: Export the new lifecycle contract from the policy package**

Update `packages/policy/src/index.ts` to expose the new evaluator and types without disturbing the existing access exports.

- [x] **Step 4: Verify package tests**

Run:

- `pnpm --filter @workspace/policy test test/unit/workspace-lifecycle.test.ts`
- `pnpm --filter @workspace/policy typecheck`

- [ ] **Step 5: Commit**

```bash
git add packages/policy
git commit -m "feat(policy): add workspace lifecycle evaluator"
```

## Task 2: Add ownership-aware lifecycle fact loading in `apps/web`

**Files:**

- Create: `apps/web/src/policy/workspace-lifecycle-capabilities.server.ts`
- Modify: `apps/web/src/workspace/workspace.server.ts`
- Create: `apps/web/test/unit/policy/workspace-lifecycle-capabilities.server.test.ts`

- [x] **Step 1: Identify or add the lowest-correct helper for owned workspace counting**

`apps/web` needs a server helper that counts the actor's owned workspaces from membership data where `member.role === 'owner'`.

Prefer exposing a focused workspace helper instead of recomputing ownership logic in multiple policy loaders.

- [x] **Step 2: Add lifecycle server tests first**

Cover at least:

- owner with two personal workspaces receives `canDeleteWorkspace === true`,
- owner with one personal workspace receives `last-personal-workspace`,
- owner receives `canLeaveWorkspace === false`,
- target owner removal receives `cannot-remove-owner`,
- non-owner receives `not-owner`,
- active subscription still blocks delete.

- [x] **Step 3: Implement the lifecycle server module**

The module should:

- ensure workspace membership where appropriate,
- load target-workspace role,
- load active subscription status,
- load owned workspace count,
- load target member role when evaluating removal,
- pass the resulting facts into `packages/policy`.

- [x] **Step 4: Keep access-policy and lifecycle-policy loading separate**

Do not overload `getWorkspaceAccessCapabilitiesForUser(...)` with lifecycle logic.

If `workspace-capabilities.server.ts` still references `isLastWorkspace` for delete-related correctness, refactor so delete checks move to the lifecycle module instead.

- [x] **Step 5: Verify targeted web tests**

Run:

- `pnpm --filter @workspace/web test test/unit/policy/workspace-lifecycle-capabilities.server.test.ts`
- `pnpm --filter @workspace/web typecheck`

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/policy apps/web/src/workspace apps/web/test/unit/policy
git commit -m "feat(web): load lifecycle workspace policy facts"
```

## Task 3: Enforce the new delete policy in the workspace settings flow

**Files:**

- Modify: `apps/web/src/workspace/workspace-settings.functions.ts`
- Modify: `apps/web/src/components/workspace/workspace-delete-dialog.tsx`
- Modify: `apps/web/test/unit/components/workspace/workspace-delete-dialog.test.tsx`

- [x] **Step 1: Update delete action to use lifecycle policy**

Replace delete authorization that depends on the access capability snapshot with lifecycle-specific enforcement.

- [x] **Step 2: Select the next workspace more safely**

Keep the current fallback intentionally simple:

- select any remaining workspace that is not the deleted one,
- rely on lifecycle policy to ensure that such a workspace exists,
- fail with a clear error if that invariant is violated unexpectedly.

- [x] **Step 3: Update the delete dialog behavior and messaging if needed**

If the server now returns blocked reasons, expose the correct denial message instead of generic failure text.

- [x] **Step 4: Add or update unit tests**

Cover:

- successful delete with remaining personal workspace,
- denial when deleting the last personal workspace,
- simple next-workspace fallback behavior.

- [x] **Step 5: Verify targeted tests**

Run:

- `pnpm --filter @workspace/web test test/unit/components/workspace/workspace-delete-dialog.test.tsx`
- `pnpm --filter @workspace/web typecheck`

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/workspace/workspace-settings.functions.ts apps/web/src/components/workspace/workspace-delete-dialog.tsx apps/web/test/unit/components/workspace/workspace-delete-dialog.test.tsx
git commit -m "fix(web): preserve a personal workspace on delete"
```

## Task 4: Enforce owner-leave and no-remove-owner lifecycle policy in members flow

**Files:**

- Modify: `apps/web/src/workspace/workspace-members.functions.ts`
- Modify: `apps/web/src/workspace/use-members-table.ts`
- Modify: `apps/web/src/components/workspace/workspace-members-table.tsx`
- Modify: `apps/web/test/unit/workspace/use-members-table.test.ts`
- Modify: `apps/web/test/e2e/workspace/members.spec.ts`

- [x] **Step 1: Move leave orchestration behind a guarded server function**

Replace direct reliance on `authClient.organization.leave(...)` for correctness with a lifecycle-aware server function.

- [x] **Step 2: Deny owner leave at the lifecycle server boundary**

Use the lifecycle fact model and an explicit `owner-cannot-leave` blocked reason.

- [x] **Step 3: Deny removing owners at the lifecycle server boundary**

Before calling `auth.api.removeMember(...)`, load the target member role and reject owner removal even if the UI attempted it.

- [x] **Step 4: Update UI behavior only as a consumer of lifecycle policy**

The members table may hide or disable owner leave and owner removal when denied, but authorization must live in the lifecycle server path.

- [x] **Step 5: Add or update unit and e2e tests**

Cover:

- non-owner leave still works,
- owner leave is denied,
- owner removal is denied.

- [x] **Step 6: Verify targeted tests**

Run:

- `pnpm --filter @workspace/web test test/unit/workspace/use-members-table.test.ts`
- `pnpm --filter @workspace/web exec playwright test test/e2e/workspace/members.spec.ts --project=chromium`

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/workspace/workspace-members.functions.ts apps/web/src/workspace/use-members-table.ts apps/web/src/components/workspace/workspace-members-table.tsx apps/web/test/unit/workspace/use-members-table.test.ts apps/web/test/e2e/workspace/members.spec.ts
git commit -m "fix(web): guard owner membership exits with lifecycle policy"
```

## Task 5: Add regression coverage for the limbo-state scenario

**Files:**

- Modify: `apps/web/test/integration/components/workspace/workspace-lifecycle-flow.integration.test.tsx`
- Modify: `apps/web/test/e2e/workspace/settings.spec.ts`

- [x] **Step 1: Add integration coverage for ownership-sensitive deletion**

Model the business case where generic membership count would be insufficient and assert delete is denied when the actor would lose his final personal workspace.

- [x] **Step 2: Add Playwright regression coverage**

Add or extend an e2e scenario that proves:

- a deletable owned workspace can still be deleted when another personal workspace remains,
- the last personal workspace cannot be deleted,
- the shell lands on a remaining workspace after successful delete.

Follow repo rules:

- run Playwright outside the sandbox,
- do not start multiple `playwright test ...` commands at the same time.

- [x] **Step 3: Verify regression tests**

Run:

- `pnpm --filter @workspace/web test test/integration/components/workspace/workspace-lifecycle-flow.integration.test.tsx`
- `pnpm --filter @workspace/web exec playwright test test/e2e/workspace/settings.spec.ts --project=chromium`

- [ ] **Step 4: Commit**

```bash
git add apps/web/test/integration/components/workspace/workspace-lifecycle-flow.integration.test.tsx apps/web/test/e2e/workspace/settings.spec.ts
git commit -m "test(web): cover last personal workspace lifecycle policy"
```

## Task 6: Re-evaluate adjacent lifecycle gaps and document any follow-up tickets

**Files:**

- Modify: `docs/superpowers/specs/2026-04-05-workspace-lifecycle-policy-design.md` if needed after implementation findings
- Modify: `docs/superpowers/plans/2026-04-05-workspace-lifecycle-policy.md` if task tracking needs updates

- [x] **Step 1: Review whether leave, owner removal, or transfer now share the same invariant**

Document any newly confirmed follow-up gaps rather than silently broadening the implementation.

- [x] **Step 2: Run cross-cutting verification**

Run the smallest broader checks justified by the changed files, such as:

- `pnpm --filter @workspace/policy lint typecheck test`
- `pnpm --filter @workspace/web lint`
- `pnpm run check:boundaries`

- [x] **Step 3: Record residual risks or deferred lifecycle rules**

Examples:

- owner transfer sequencing,
- removing the final owner from a workspace,
- richer next active workspace selection rules if product needs them later.

- [ ] **Step 4: Commit**

```bash
git add docs/superpowers/specs/2026-04-05-workspace-lifecycle-policy-design.md docs/superpowers/plans/2026-04-05-workspace-lifecycle-policy.md
git commit -m "docs(policy): capture lifecycle policy follow-up"
```

## Definition Of Done

This plan is complete when:

- `packages/policy` exposes a lifecycle evaluator for delete-workspace decisions,
- `packages/policy` exposes lifecycle outcomes for owner leave and owner-removal decisions,
- `apps/web` computes owned-workspace facts from membership ownership, not generic workspace count,
- delete-workspace denies deleting the last personal workspace,
- owner leave is denied,
- owner removal is denied,
- successful delete keeps a simple next-workspace fallback,
- the limbo-state scenario is covered by tests,
- the follow-up lifecycle-policy architecture is documented against the rebased `main` branch.
