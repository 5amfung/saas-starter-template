# Admin Operational Policy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Follow up on Section 14.4 of the shared policy capability design by replacing coarse admin-entry checks with richer platform-admin operational capabilities for read, modify, support, destructive, and billing-override actions across `apps/admin`.

**Architecture:** Extend `@workspace/policy` with a more granular admin operational capability model while keeping fact loading and framework integration in `apps/admin`. Move admin operational reads and mutations behind app server functions guarded by explicit admin capabilities, so routes/components consume evaluated capabilities and no longer depend on client-side `authClient.admin.*` calls or generic `requireAdmin()` checks for sensitive behavior.

**Tech Stack:** TypeScript, pnpm workspaces, TanStack Start, TanStack Router, TanStack Query, Better Auth, Vitest, Dependency Cruiser.

---

## Scope and Gap Summary

Section 14.4 calls for richer platform-admin capability modeling in `apps/admin`, specifically:

- read vs modify capabilities,
- support actions vs destructive actions,
- billing override actions vs analytics/reporting actions.

Current repo gaps:

- `packages/policy/src/admin-app.ts` only models coarse booleans:
  - `canAccessAdminApp`
  - `canViewAdminDashboard`
  - `canViewUsers`
  - `canViewWorkspaces`
  - `canManageEntitlementOverrides`
- Admin server functions still rely on generic `requireAdmin()` in:
  - `apps/admin/src/admin/admin.functions.ts`
  - `apps/admin/src/admin/workspaces.functions.ts`
- Admin user flows currently bypass app server-function policy entirely and call `authClient.admin.*` directly from routes/components:
  - `apps/admin/src/routes/_protected/users/index.tsx`
  - `apps/admin/src/routes/_protected/users/$userId.tsx`
  - `apps/admin/src/components/admin/admin-user-form.tsx`
  - `apps/admin/src/components/admin/admin-delete-user-dialog.tsx`
- Admin navigation is static in `apps/admin/src/components/app-sidebar.tsx` and does not reflect evaluated capabilities.
- Admin detail routes do not currently gate specific operational slices with capability-specific loaders or guards.

This plan addresses admin operational policy only. It does not redesign auth entry itself and does not change non-admin apps.

## Ownership Rules

- `packages/policy`
  Owns platform-admin capability names, typed context, evaluator, and pure capability helpers.
- `apps/admin/src/policy/*`
  Owns loading admin facts from session/context and exposing route/server guard helpers.
- `apps/admin/src/admin/*`
  Owns admin server functions and server-side integration with Better Auth and shared packages.
- `apps/admin/src/routes/*` and `apps/admin/src/components/*`
  Consume capability outputs and server functions; they should not infer privileged behavior from raw admin role checks or issue direct privileged client mutations.
- `packages/auth`
  Remains auth/provider infrastructure; it should not become the owner of admin operational policy decisions.

## File Map

### New files

- `packages/policy/test/unit/admin-app-operations.test.ts`
- `apps/admin/src/admin/users.functions.ts`
- `apps/admin/src/admin/users.server.ts`
- `apps/admin/src/admin/users.schemas.ts`
- `apps/admin/test/unit/policy/admin-app-capabilities.server.test.ts`
- `apps/admin/test/unit/admin/users.functions.test.ts`

### Existing files expected to change

- `packages/policy/src/admin-app.ts`
- `packages/policy/src/index.ts`
- `apps/admin/src/policy/admin-app-capabilities.shared.ts`
- `apps/admin/src/policy/admin-app-capabilities.server.ts`
- `apps/admin/src/policy/admin-app-capabilities.functions.ts`
- `apps/admin/src/components/app-sidebar.tsx`
- `apps/admin/src/routes/_protected.tsx`
- `apps/admin/src/routes/_protected/dashboard.tsx`
- `apps/admin/src/routes/_protected/users/index.tsx`
- `apps/admin/src/routes/_protected/users/$userId.tsx`
- `apps/admin/src/routes/_protected/workspaces/index.tsx`
- `apps/admin/src/routes/_protected/workspaces/$workspaceId.tsx`
- `apps/admin/src/admin/admin.functions.ts`
- `apps/admin/src/admin/admin.server.ts`
- `apps/admin/src/admin/workspaces.functions.ts`
- `apps/admin/src/admin/workspaces.server.ts`
- `apps/admin/src/components/admin/admin-user-form.tsx`
- `apps/admin/src/components/admin/admin-delete-user-dialog.tsx`
- `apps/admin/src/components/admin/admin-user-table.tsx`
- `apps/admin/src/components/admin/admin-entitlement-override-form.tsx`
- `apps/admin/test/unit/components/admin-user-form.test.tsx`
- `apps/admin/test/unit/components/admin-delete-user-dialog.test.tsx`
- `apps/admin/test/unit/components/app-sidebar.test.tsx`

## Capability Direction

Replace the coarse admin-app capability surface with operational capability groups that map to actual admin actions. A likely first-pass shape:

```ts
interface AdminAppCapabilities {
  platformRole: PlatformRole | null;
  canAccessAdminApp: boolean;

  canViewDashboard: boolean;
  canViewAnalytics: boolean;

  canViewUsers: boolean;
  canManageUsers: boolean;
  canDeleteUsers: boolean;

  canViewWorkspaces: boolean;
  canViewWorkspaceBilling: boolean;
  canManageEntitlementOverrides: boolean;

  canPerformSupportActions: boolean;
}
```

The implementation can collapse some of these to the same current role in V1, but the capability names must reflect distinct operations so routes and functions stop depending on a single “is admin” gate.

## File Structure Notes

- Keep `packages/policy/src/admin-app.ts` pure and fact-based.
- Add app-local guard helpers rather than importing raw evaluator checks into route/components repeatedly.
- Move all privileged user mutations into `apps/admin/src/admin/users.functions.ts` and `apps/admin/src/admin/users.server.ts`.
- Continue using Better Auth APIs under the server layer, not directly from client components.

## Task 1: Expand the shared admin operational capability model

**Files:**

- Modify: `packages/policy/src/admin-app.ts`
- Modify: `packages/policy/src/index.ts`
- Create: `packages/policy/test/unit/admin-app-operations.test.ts`

- [x] **Step 1: Write failing policy tests for operational capabilities**

Cover at least:

- admin session can view dashboard, users, workspaces, analytics, and support actions,
- admin session can manage users and entitlement overrides,
- destructive user deletion is a distinct capability from generic read access,
- non-admin session gets no operational capabilities.

- [x] **Step 2: Extend the pure evaluator and types**

Add the new capability names and keep `hasAdminAppCapability(...)` working for the expanded union.

- [x] **Step 3: Export the updated capability surface**

Make the new types and helpers available via `@workspace/policy`.

- [x] **Step 4: Run focused verification**

Run:

```bash
pnpm --filter @workspace/policy test
pnpm --filter @workspace/policy typecheck
```

Expected: new admin operational capability tests fail first, then pass once the evaluator is updated.

- [x] **Step 5: Commit**

```bash
git add packages/policy/src/admin-app.ts packages/policy/src/index.ts packages/policy/test/unit/admin-app-operations.test.ts
git commit -m "feat(policy): expand admin operational capabilities"
```

## Task 2: Add admin app-local capability guards and route access adapters

**Files:**

- Modify: `apps/admin/src/policy/admin-app-capabilities.shared.ts`
- Modify: `apps/admin/src/policy/admin-app-capabilities.server.ts`
- Modify: `apps/admin/src/policy/admin-app-capabilities.functions.ts`
- Create: `apps/admin/test/unit/policy/admin-app-capabilities.server.test.ts`

- [x] **Step 1: Write failing adapter tests**

Verify the admin app server helpers can require specific operational capabilities and return the expanded capability object for route and server-function use.

- [x] **Step 2: Add focused guard helpers**

Introduce app-local helpers such as:

- `requireCurrentAdminAppCapability('canViewUsers')`
- `requireCurrentAdminAppCapability('canManageUsers')`
- `requireCurrentAdminAppCapability('canDeleteUsers')`
- `requireCurrentAdminAppCapability('canManageEntitlementOverrides')`

- [x] **Step 3: Keep session fact loading centralized**

Do not duplicate session-role normalization in routes or server functions.

- [x] **Step 4: Run focused verification**

Run:

```bash
pnpm --filter @workspace/admin-web test test/unit/policy/admin-app-capabilities.server.test.ts
pnpm --filter @workspace/admin-web typecheck
```

Expected: admin app adapters expose the richer capability model cleanly.

- [x] **Step 5: Commit**

```bash
git add apps/admin/src/policy/admin-app-capabilities.shared.ts apps/admin/src/policy/admin-app-capabilities.server.ts apps/admin/src/policy/admin-app-capabilities.functions.ts apps/admin/test/unit/policy/admin-app-capabilities.server.test.ts
git commit -m "refactor(admin): add operational policy guards"
```

## Task 3: Move admin dashboard and workspace reads onto capability-specific guards

**Files:**

- Modify: `apps/admin/src/admin/admin.functions.ts`
- Modify: `apps/admin/src/admin/admin.server.ts`
- Modify: `apps/admin/src/admin/workspaces.functions.ts`
- Modify: `apps/admin/src/admin/workspaces.server.ts`

- [x] **Step 1: Replace generic `requireAdmin()` usage for analytics reads**

Map:

- dashboard summary and metrics to `canViewDashboard` / `canViewAnalytics`

- [x] **Step 2: Replace generic `requireAdmin()` usage for workspace reads and override writes**

Map:

- workspace list/detail reads to `canViewWorkspaces`,
- workspace billing detail reads to `canViewWorkspaceBilling`,
- entitlement override writes to `canManageEntitlementOverrides`.

- [x] **Step 3: Keep server-only Better Auth/DB integration under server modules**

Do not push authorization checks back into route or component code.

- [x] **Step 4: Run focused verification**

Run:

```bash
pnpm --filter @workspace/admin-web test
pnpm --filter @workspace/admin-web typecheck
```

Expected: reads and override writes are guarded by explicit operational capabilities.

- [x] **Step 5: Commit**

```bash
git add apps/admin/src/admin/admin.functions.ts apps/admin/src/admin/admin.server.ts apps/admin/src/admin/workspaces.functions.ts apps/admin/src/admin/workspaces.server.ts
git commit -m "refactor(admin): guard analytics and workspace ops by capability"
```

## Task 4: Introduce server-backed admin user operations

**Files:**

- Create: `apps/admin/src/admin/users.schemas.ts`
- Create: `apps/admin/src/admin/users.server.ts`
- Create: `apps/admin/src/admin/users.functions.ts`
- Create: `apps/admin/test/unit/admin/users.functions.test.ts`

- [x] **Step 1: Write failing tests for user read/update/delete server functions**

Cover:

- list users requires `canViewUsers`,
- get user detail requires `canViewUsers`,
- update user requires `canManageUsers`,
- delete user requires `canDeleteUsers`,
- self-delete remains blocked even when delete capability exists.

- [x] **Step 2: Move Better Auth admin calls behind server functions**

Server modules should own `listUsers`, single-user lookup, `updateUser`, and `removeUser`.

- [x] **Step 3: Add typed schemas for admin user updates**

Keep validation consistent with the existing form schema and route needs.

- [x] **Step 4: Run focused verification**

Run:

```bash
pnpm --filter @workspace/admin-web test test/unit/admin/users.functions.test.ts
pnpm --filter @workspace/admin-web typecheck
```

Expected: privileged user operations are no longer client-direct and are capability-guarded.

- [x] **Step 5: Commit**

```bash
git add apps/admin/src/admin/users.schemas.ts apps/admin/src/admin/users.server.ts apps/admin/src/admin/users.functions.ts apps/admin/test/unit/admin/users.functions.test.ts
git commit -m "feat(admin): add guarded server functions for user ops"
```

## Task 5: Rewire admin user routes and components to consume guarded functions

**Files:**

- Modify: `apps/admin/src/routes/_protected/users/index.tsx`
- Modify: `apps/admin/src/routes/_protected/users/$userId.tsx`
- Modify: `apps/admin/src/components/admin/admin-user-form.tsx`
- Modify: `apps/admin/src/components/admin/admin-delete-user-dialog.tsx`
- Modify: `apps/admin/src/components/admin/admin-user-table.tsx`
- Modify: `apps/admin/test/unit/components/admin-user-form.test.tsx`
- Modify: `apps/admin/test/unit/components/admin-delete-user-dialog.test.tsx`

- [x] **Step 1: Replace direct `authClient.admin.*` calls**

Routes and components should call app server functions instead of issuing privileged admin mutations directly from the client.

- [x] **Step 2: Render operation availability from capabilities**

Examples:

- user list visible only with `canViewUsers`,
- edit controls enabled only with `canManageUsers`,
- danger-zone delete visible/enabled only with `canDeleteUsers`.

- [x] **Step 3: Preserve UX-specific constraints**

Keep “cannot delete your own account” as an additional business rule layered on top of capability checks.

- [x] **Step 4: Run focused verification**

Run:

```bash
pnpm --filter @workspace/admin-web test test/unit/components/admin-user-form.test.tsx
pnpm --filter @workspace/admin-web test test/unit/components/admin-delete-user-dialog.test.tsx
```

Expected: client UI consumes capabilities and guarded server functions, with no direct privileged Better Auth calls left in these flows.

- [x] **Step 5: Commit**

```bash
git add apps/admin/src/routes/_protected/users/index.tsx 'apps/admin/src/routes/_protected/users/$userId.tsx' apps/admin/src/components/admin/admin-user-form.tsx apps/admin/src/components/admin/admin-delete-user-dialog.tsx apps/admin/src/components/admin/admin-user-table.tsx apps/admin/test/unit/components/admin-user-form.test.tsx apps/admin/test/unit/components/admin-delete-user-dialog.test.tsx
git commit -m "refactor(admin): route user operations through policy-guarded flows"
```

## Task 6: Make admin navigation and route entry capability-aware

**Files:**

- Modify: `apps/admin/src/components/app-sidebar.tsx`
- Modify: `apps/admin/src/routes/_protected.tsx`
- Modify: `apps/admin/src/routes/_protected/dashboard.tsx`
- Modify: `apps/admin/src/routes/_protected/workspaces/index.tsx`
- Modify: `apps/admin/src/routes/_protected/workspaces/$workspaceId.tsx`
- Modify: `apps/admin/test/unit/components/app-sidebar.test.tsx`

- [x] **Step 1: Hide unavailable admin sections from navigation**

Use evaluated capabilities to conditionally render dashboard, users, and workspaces nav items.

- [x] **Step 2: Add route-level access enforcement for major admin sections**

Routes should fail closed when the required capability is absent, instead of assuming app entry implies section access.

- [x] **Step 3: Keep shared layout gating minimal**

`canAccessAdminApp` should continue to gate app entry, while section routes enforce their own operational capabilities.

- [x] **Step 4: Run focused verification**

Run:

```bash
pnpm --filter @workspace/admin-web test test/unit/components/app-sidebar.test.tsx
pnpm --filter @workspace/admin-web typecheck
```

Expected: navigation and route access align with the new operational capability model.

- [x] **Step 5: Commit**

```bash
git add apps/admin/src/components/app-sidebar.tsx apps/admin/src/routes/_protected.tsx apps/admin/src/routes/_protected/dashboard.tsx apps/admin/src/routes/_protected/workspaces/index.tsx 'apps/admin/src/routes/_protected/workspaces/$workspaceId.tsx' apps/admin/test/unit/components/app-sidebar.test.tsx
git commit -m "refactor(admin): align routes and nav with operational policy"
```

## Task 7: Final verification and architecture checks

**Files:**

- Modify: any touched files above as needed from verification fixes

- [x] **Step 1: Run affected admin suites**

```bash
pnpm --filter @workspace/admin-web test
pnpm --filter @workspace/admin-web typecheck
```

Expected: admin route, policy, and component tests pass.

- [x] **Step 2: Run shared package verification**

```bash
pnpm --filter @workspace/policy test
pnpm --filter @workspace/policy typecheck
```

Expected: expanded admin capability evaluator remains green.

- [x] **Step 3: Run repo-wide safety checks**

```bash
pnpm run typecheck
pnpm run check:boundaries
```

Expected: no new type or boundary violations.

- [x] **Step 4: Manual architecture review**

Confirm all of the following before calling the work complete:

- admin user update/delete no longer happens through client-direct privileged auth calls,
- analytics, workspace reads, and override writes each map to explicit capabilities,
- app entry and section access remain distinct,
- dangerous operations have narrower capability names than general read access,
- route and nav gating reflect the evaluated admin capability surface.

- [x] **Step 5: Commit verification fixes**

No additional verification-fix code commit was needed after the final green
checks; the remaining documentation update here records completed execution.

```bash
git add .
git commit -m "test: verify admin operational policy rollout"
```

## Risks and Tradeoffs

- Do not overfit the first capability split to today’s single `admin` role. The names should model operations, even if the current evaluator still grants them all to one role.
- Keep app server functions as the enforcement point for privileged operations; capability-aware UI alone is insufficient.
- Avoid pushing Better Auth admin APIs directly into client components again once the server-function boundary exists.
- If user-management and workspace-management slices become too large together, split execution into two branches after the shared capability surface lands.

## Definition of Done

This follow-up is complete when all of the following are true:

1. `@workspace/policy` exposes a richer admin operational capability model.
2. Admin analytics, workspace operations, and entitlement override writes are guarded by explicit capabilities instead of generic `requireAdmin()` checks.
3. Admin user list/detail/update/delete flows run through app server functions with capability guards.
4. Client routes/components no longer issue privileged admin mutations directly through `authClient.admin.*`.
5. Admin nav and route entry reflect evaluated section capabilities.
6. Affected tests, typecheck, and boundary checks pass.

## Handoff

Plan complete and saved to `docs/superpowers/plans/2026-04-06-admin-operational-policy.md`. Two execution options:

1. Subagent-Driven (recommended) - I dispatch a fresh subagent per task, review between tasks, fast iteration
2. Inline Execution - Execute tasks in this session using executing-plans, batch execution with checkpoints
