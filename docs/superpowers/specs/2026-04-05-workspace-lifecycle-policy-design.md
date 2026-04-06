# Workspace Lifecycle Policy Design

**Date:** 2026-04-05
**Goal:** Extend the shared capability architecture with a dedicated workspace lifecycle policy so destructive membership and ownership transitions cannot leave a user without any personal workspace.
**Approach:** Keep the existing `facts -> evaluator -> capabilities/guards` pattern, but introduce explicit lifecycle facts and lifecycle outcomes for workspace deletion and membership exits/removals.
**Builds on:** `docs/superpowers/specs/2026-04-04-shared-policy-capability-architecture-design.md`
**Also aligned with:** `docs/superpowers/specs/2026-04-05-app-state-architecture-design.md`
**Scope exclusion:** This design does not broaden authentication-entry policy yet and does not replace the existing page/action capability model for non-lifecycle access decisions.

---

## 1. Context

The shared capability architecture is already merged on `main`, and `apps/web` now guards billing, settings, and member-management behavior through `packages/policy`.

Since then, `main` also introduced a clearer app-state ownership model in `apps/web` through dedicated workspace query and mutation modules.

That foundation fixed the first class of drift, but a small set of lifecycle gaps remains:

- delete-workspace policy still relies on coarse `isLastWorkspace` facts,
- `isLastWorkspace` is derived from total workspace memberships rather than owned workspaces,
- workspace deletion still picks the next active workspace from a simple remaining-organization fallback,
- owner leave is still exposed in the current web app flow,
- owner removal is blocked in UI, but not yet modeled as a lifecycle server rule,
- the current rule can prevent some bad deletes, but it does not encode the true safety invariant.

The safety invariant is stronger than "user must still belong to a workspace."

The new business rule is:

- a user may delete a workspace only if deleting it would still leave him with at least one personal workspace.

For this design:

- personal workspace means a workspace where the user has `owner` role in the `member` table.

## 2. Problem Statement

The current implementation can still leave a user in a limbo state because it reasons about workspace count too broadly.

Example:

- User A belongs to Workspace A and Workspace B
- User B belongs to Workspace A and Workspace C
- User B owns Workspace C
- User A later deletes Workspace A

If User B was previously allowed to delete Workspace C, User B can end up with no personal workspace at all.

This reveals the current lifecycle modeling issues:

1. `isLastWorkspace` is not the right lifecycle fact.
2. destructive membership exits still rely too much on UI behavior instead of lifecycle policy.
3. the repo needs the lifecycle layer to fit the newer app-state ownership boundaries in `apps/web`.

## 3. Objective

Add a lifecycle-policy layer on top of the current capability architecture that:

- models ownership-sensitive workspace transitions explicitly,
- enforces the "last personal workspace" invariant for deletion,
- disallows owner leave,
- disallows removing owners from a workspace,
- returns typed denial reasons for lifecycle actions,
- keeps apps responsible for fact loading and orchestration,
- creates a reusable policy pattern for later lifecycle transitions.

## 4. Design Principles

1. Lifecycle policy is separate from page/action visibility policy.
2. Ownership safety must be modeled from owned workspaces, not total memberships.
3. Facts stay explicit and intention-revealing.
4. Apps load lifecycle facts; `packages/policy` evaluates them.
5. UI renders lifecycle outcomes; server functions enforce them.
6. A user may hold many memberships, but lifecycle safety is defined by personal ownership.
7. Workspace membership exits must not create ownerless workspaces.

## 5. Why The Current Model Is Insufficient

The current `WorkspacePolicyContext` includes:

```ts
interface WorkspacePolicyContext {
  workspaceRole: WorkspaceRole | null;
  isLastWorkspace: boolean;
  hasActiveSubscription: boolean;
}
```

This works for initial access control, but it is too ambiguous for destructive lifecycle actions.

`isLastWorkspace` does not tell us:

- whether the user owns the remaining workspaces,
- whether the remaining workspaces are only member/admin memberships,
- whether a later ownership transition could strand the user,
- which workspace should become active after deletion.

For lifecycle policy, we need ownership-aware facts.

## 6. Policy Domain Split

The workspace domain should now have two related but distinct policy surfaces.

### 6.1 Access policy

Owns:

- view/manage billing
- view/manage settings
- invite/manage members
- page-level and action-level authorization

### 6.2 Lifecycle policy

Owns:

- delete workspace
- leave workspace
- remove member
- future active-workspace switching constraints if needed

The two surfaces may share some facts, but they should not be collapsed into one overloaded evaluator.

This follow-up intentionally does not expand into ownership transfer or owner demotion, because those are not current product flows the team wants to tackle in this slice.

## 7. Proposed Shared Contracts

Introduce a lifecycle-specific policy contract in `packages/policy`.

### 7.1 Lifecycle context

```ts
type WorkspaceRole = 'owner' | 'admin' | 'member';

interface WorkspaceLifecyclePolicyContext {
  actorWorkspaceRole: WorkspaceRole | null;
  ownedWorkspaceCount: number;
  hasActiveSubscription: boolean;
}
```

Optional future extensions:

- `membershipWorkspaceCount`
- `targetWorkspaceId`
- `nextOwnedWorkspaceId`
- `pendingOwnerTransfer`

Only add them when a concrete lifecycle rule needs them.

### 7.2 Lifecycle result

```ts
type DeleteWorkspaceBlockedReason =
  | 'not-owner'
  | 'active-subscription'
  | 'last-personal-workspace';

interface WorkspaceLifecycleCapabilities {
  canDeleteWorkspace: boolean;
  deleteWorkspaceBlockedReason: DeleteWorkspaceBlockedReason | null;
  canLeaveWorkspace: boolean;
  leaveWorkspaceBlockedReason: 'owner-cannot-leave' | null;
  canRemoveMember: boolean;
  removeMemberBlockedReason:
    | 'cannot-remove-owner'
    | 'cannot-remove-self'
    | null;
}
```

This follows the same pattern as the existing capability model, but it keeps lifecycle outcomes explicit and explainable.

## 8. Initial Lifecycle Rule: Delete Workspace

The delete rule should now be:

```ts
canDeleteWorkspace =
  actorWorkspaceRole === 'owner' &&
  !hasActiveSubscription &&
  ownedWorkspaceCount > 1;
```

Interpretation:

- only owners can delete a workspace,
- workspaces with active subscriptions still cannot be deleted,
- the deleting user must retain at least one personal workspace after the delete,
- total workspace membership count is not sufficient.

## 9. Initial Lifecycle Rule: Leave Workspace

The current application behavior still exposes owner leave in the members UI and test suite.

The agreed product rule is simpler than the earlier ownership-count proposal:

- an owner cannot leave a workspace he owns.

That means the lifecycle policy should guard leave-workspace as:

```ts
canLeaveWorkspace =
  actorWorkspaceRole !== null && actorWorkspaceRole !== 'owner';
```

Interpretation:

- non-owners may leave their workspace membership,
- owners may not leave at all,
- this rule preserves the invariant that a workspace cannot become ownerless through self-exit.

## 10. Initial Lifecycle Rule: Remove Member

The current members table already disables `Remove` for owner rows, but that is only a UI guard.

The server-side lifecycle rule should be:

```ts
canRemoveMember =
  actorWorkspaceRole === 'owner' || actorWorkspaceRole === 'admin';

if (targetMemberRole === 'owner') {
  canRemoveMember = false;
}
```

Interpretation:

- admins and owners may remove non-owner members if general member-management policy allows it,
- no one may remove an owner from a workspace,
- self-removal should continue to use the leave flow rather than the remove-member flow.

## 11. App Fact Loading Responsibilities

`packages/policy` must remain pure. Therefore `apps/web` must load the new lifecycle facts.

### 11.1 Required `apps/web` facts

For delete-workspace, leave-workspace, and remove-member evaluation, `apps/web` must determine:

- the actor's role in the target workspace,
- whether the target workspace has an active subscription,
- how many workspaces the actor currently owns.
- for remove-member, the target member's role in the workspace.

### 11.2 Ownership count source

Ownership count must be derived from membership data where:

- the actor is a member of the workspace, and
- `member.role === 'owner'`.

This is different from:

- the current `listUserWorkspaces(...)` count,
- generic organization lists,
- active organization state.

## 12. App Integration Pattern

The current architecture pattern should remain intact.

1. `apps/web` loads lifecycle facts.
2. `apps/web` constructs `WorkspaceLifecyclePolicyContext`.
3. `packages/policy` evaluates lifecycle outcomes.
4. web server functions guard lifecycle actions from those outcomes.
5. UI reads lifecycle outcomes for messaging and button state, but does not authorize.

With the new app-state architecture on `main`, this should align with app-owned workspace boundaries:

- server fact loading in `apps/web/src/workspace/workspace.server.ts` and related policy server modules,
- client state updates through `apps/web/src/workspace/workspace.queries.ts` and `apps/web/src/workspace/workspace.mutations.ts`,
- route/UI consumption through app-local hooks and route loaders.

Likely app-facing APIs:

- `getWorkspaceLifecycleCapabilitiesForUser(...)`
- `requireWorkspaceLifecycleCapabilityForUser(..., 'canDeleteWorkspace')`
- `requireWorkspaceLifecycleCapabilityForUser(..., 'canLeaveWorkspace')`
- `requireWorkspaceLifecycleRemovalAllowedForUser(...)`

The existing access-policy APIs can remain for non-lifecycle behavior.

## 13. Delete Flow Changes Required In `apps/web`

The current delete flow needs two follow-up changes.

### 13.1 Replace `isLastWorkspace`

Current behavior in `apps/web/src/policy/workspace-capabilities.server.ts` derives delete eligibility from total workspaces.

That should be replaced for delete decisions with:

- `ownedWorkspaceCount`

This can happen either by:

- introducing a dedicated lifecycle loader, or
- extending the existing server policy module with lifecycle-specific helpers.

The cleaner option is a dedicated lifecycle helper so access and lifecycle concerns stay separate.

### 13.2 Keep next workspace resolution simple

Current delete logic in `apps/web/src/workspace/workspace-settings.functions.ts` picks the next active workspace from the first organization that is not the deleted one.

This is a lower-priority concern than the ownership invariant itself.

For this slice, the implementation should stay simple:

- continue selecting any remaining workspace that is not the deleted one,
- do not introduce a more sophisticated ranking policy yet,
- only fail if no remaining workspace exists, which should be prevented by the lifecycle guard.

## 14. Leave And Remove-Member Flow Changes Required In `apps/web`

The current members flow calls `authClient.organization.leave(...)` directly from the client hook.

For this slice:

- owner leave should be guarded by lifecycle policy instead of implicit client behavior,
- the leave flow should stop relying on raw client-side behavior for correctness,
- owner leave must be denied for owners,
- remove-member must reject attempts to remove owners at the server boundary.

This likely requires:

- moving leave orchestration onto a guarded server-function path, just as delete uses a server action,
- adding target-member role checks before calling `auth.api.removeMember(...)`,
- leaving UI disable states in place as usability affordances, not as the source of truth.

## 15. Typed Denial Reasons

Lifecycle policy should produce typed blocked reasons so all layers explain denials consistently.

Benefits:

- UI can show the right message before submit,
- server functions can throw stable forbidden errors,
- tests can assert both allow/deny and reason,
- future lifecycle rules can compose without ad hoc strings.

For the initial delete rule:

- `not-owner`
- `active-subscription`
- `last-personal-workspace`

For the initial leave rule:

- `owner-cannot-leave`

For the initial remove-member rule:

- `cannot-remove-owner`

## 16. Relationship To Section 14.2 Of The Previous Spec

Section 14.2 of the 2026-04-04 design spec identified workspace lifecycle policy as a future expansion area.

This document turns that follow-up into a concrete second slice of the architecture by:

- narrowing the domain to lifecycle transitions,
- replacing generic workspace-count reasoning with ownership-aware reasoning,
- establishing a shared contract for deletion,
- defining the next set of lifecycle-policy responsibilities.

## 17. Deferred Lifecycle Gaps

Delete, leave, and remove-owner protection are the lifecycle actions in scope for this follow-up.

The following transitions are intentionally deferred:

- ownership transfer,
- owner demotion,
- more sophisticated active workspace selection after destructive lifecycle transitions.

These are follow-up slices, not all required in the first implementation pass.

The reason they are deferred is not that they are unimportant. It is that they are not current product workflows the team wants to address in this slice.

## 18. Out Of Scope For This Follow-Up

- redesigning the existing access capability contract,
- introducing a full permissions engine,
- broadening auth-entry policy,
- solving every lifecycle transition in one change,
- changing platform-admin policy in `apps/admin`.

## 19. Definition Of Done

This lifecycle-policy follow-up is successfully implemented when all of the following are true:

1. Delete-workspace policy is evaluated from ownership-aware lifecycle facts.
2. Leave-workspace policy is also evaluated from ownership-aware lifecycle facts.
3. Remove-member cannot remove owners at the server boundary.
4. A user cannot delete his last personal workspace.
5. An owner cannot leave his workspace.
6. Delete-workspace enforcement no longer depends on generic `isLastWorkspace` for correctness.
7. The delete action keeps a simple "any remaining workspace" fallback after successful delete.
8. Lifecycle policy emits typed blocked reasons for delete, leave, and remove-owner denials.
9. Tests cover both the direct rules and the limbo-state regression scenario.
10. The new lifecycle-policy pattern is documented as a follow-up layer on top of the shared capability architecture and the newer web app-state ownership model.
