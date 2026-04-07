# Workspace Ownership Transfer Design

Date: 2026-04-06
Issue: SF-9

## Summary

Add the ability for a workspace owner to transfer ownership to another existing workspace member from the Members table. The target member must already belong to the workspace and may currently have the `member` or `admin` role.

The action is initiated from the target member's row under the action column. It opens a destructive confirmation modal that requires the current owner to type `TRANSFER` before confirming.

After a successful transfer:

- the selected member becomes the new `owner`
- the previous owner is demoted to `admin`
- billing for the workspace remains unchanged
- a success toast is shown

This feature does not migrate the Stripe customer or payment method from the original owner to the new owner. The new owner must coordinate payment transfer separately in Stripe.

## Goals

- Allow the current owner to transfer workspace ownership to another workspace member.
- Keep the action discoverable from the Members table row actions.
- Make the action intentionally difficult to perform accidentally through a danger-style modal and typed confirmation.
- Preserve the product invariant that a workspace has exactly one owner after a successful transfer.
- Keep billing and entitlements anchored to the workspace, not the owner identity.

## Non-Goals

- Migrating Stripe customer ownership, billing contacts, or payment methods.
- Introducing general-purpose role editing UI.
- Allowing transfer to users who are not already members of the workspace.
- Supporting reversible or undo-style transfer behavior.

## Current Constraints

### Better Auth behavior

This repository currently uses `better-auth@1.5.5`.

The installed Better Auth organization plugin exposes `updateMemberRole`, but the implementation only updates the targeted member's row. It does not automatically demote the existing owner when another member is promoted to `owner`.

That means ownership transfer cannot rely on a single Better Auth primitive that preserves the single-owner invariant. The application must explicitly coordinate the role swap on the server.

### Existing repository patterns

- Sensitive workspace lifecycle actions already use server-side capability guards plus client-side confirmation UI.
- Workspace-specific server mutations live in `apps/web/src/workspace/*.functions.ts`.
- Lifecycle permission rules live in `packages/policy` and are enforced through `apps/web/src/policy/*`.
- The Members table is already the correct surface for member-targeted actions like remove and leave.

## User Experience

### Entry point

The `Transfer ownership` action appears in the Members table action menu for eligible rows only.

It is shown only when:

- the current actor is the workspace `owner`
- the target row is not the current user
- the target row role is `member` or `admin`

It is not shown for:

- the current owner row
- rows that are already `owner`
- viewers who are `admin` or `member`

### Confirmation modal

Clicking `Transfer ownership` opens a destructive confirmation modal.

The modal should:

- visually match the existing danger-zone styling used for destructive workspace actions
- clearly identify that ownership of the workspace is being transferred
- explain that the selected member will become owner
- explain that the current owner will be demoted to `admin` because there can only be one owner per workspace
- explain that workspace billing remains unchanged, but payment transfer in Stripe must be handled separately
- explain that the action cannot be reversed unless the new owner later transfers ownership back
- require the user to type `TRANSFER` before the confirm button becomes enabled
- provide a `Cancel` button to dismiss the modal
- provide a `Transfer ownership` submit button
- show a spinning loader before the `Transfer ownership` label while the mutation is pending

### Success behavior

On success:

- the modal closes
- the members data refreshes
- role-dependent capability data refreshes
- the previous owner sees updated role-based UI consistent with being an `admin`
- a success toast is shown

Toast copy:

`Workspace ownership transferred successfully.`

## Architecture

### High-level flow

The client launches a transfer dialog from the Members table. The dialog submits to a dedicated server function named `transferWorkspaceOwnership`.

That server function performs a controlled ownership swap:

1. verify the current session
2. verify actor membership and authority
3. verify the target member exists in the same workspace
4. promote the target member to `owner`
5. demote the current owner to `admin`
6. re-read members and assert there is exactly one owner and it is the target member
7. return success

The client does not call Better Auth role updates directly. The swap is owned entirely by the server.

### Files and layers

Likely implementation locations:

- `packages/policy/src/workspace-lifecycle.ts`
  - add transfer capability evaluation and blocked reasons
- `apps/web/src/policy/workspace-lifecycle-capabilities.server.ts`
  - add transfer-specific guard helpers
- `apps/web/src/policy/workspace-lifecycle-capabilities.functions.ts`
  - expose any additional lifecycle capability fetch needed by the route
- `apps/web/src/workspace/workspace-members.functions.ts`
  - add `transferWorkspaceOwnership`
- `apps/web/src/workspace/workspace.server.ts`
  - add helpers to read target/current membership details if needed
- `apps/web/src/workspace/use-members-table.ts`
  - add transfer mutation, pending state, refetch/invalidation
- `apps/web/src/components/workspace/workspace-members-table.tsx`
  - add the new row action and modal wiring
- `apps/web/src/components/workspace/`
  - add a dedicated transfer-ownership dialog component

## Policy Rules

### Eligibility

Transfer is allowed only when:

- actor role in the workspace is `owner`
- target member exists in the same workspace
- target member is not the acting owner
- target member role is `member` or `admin`

Transfer is blocked when:

- actor is not an owner
- target member is not found
- target member is the acting owner
- target member already has the `owner` role

### Capability shape

Add a transfer-specific lifecycle capability rather than folding this into general `canManageMembers`.

Suggested shape:

- `canTransferWorkspaceOwnership`
- `transferWorkspaceOwnershipBlockedReason`

Suggested blocked reasons:

- `not-owner`
- `target-not-found`
- `cannot-transfer-to-self`
- `target-already-owner`

## Server Mutation Design

### Function contract

Add a server function:

- name: `transferWorkspaceOwnership`
- input: `{ workspaceId: string; memberId: string }`

### Validation and checks

The mutation should:

- require a verified session
- ensure the actor is a member of the workspace
- load the actor's member record and role
- load the target member record
- reject if actor is not owner
- reject if target is self
- reject if target is already owner
- reject if target does not belong to the workspace

### Role update sequence

Because Better Auth does not auto-demote the current owner, the app must explicitly perform both updates.

Proposed sequence:

1. update target member role to `owner`
2. update acting owner's member role to `admin`
3. fetch the latest organization member list
4. assert:
   - exactly one member has role `owner`
   - that owner is the target member
   - the actor now has role `admin`

If the post-write invariant check fails, the server function should throw and the operation should be treated as unsuccessful.

### Transaction note

The Better Auth API exposes two independent role updates. Based on the installed implementation, this flow should be designed as a controlled server-side sequence plus post-write verification, not as a library-guaranteed atomic transfer.

If implementation reveals a safe database-transaction boundary through the existing auth stack, that can be considered as an enhancement, but it is not assumed in this design.

## UI Component Design

### Members table

Extend the action-menu cell in the Members table to support a new destructive action for eligible target rows:

- `Transfer ownership`

This action should coexist with existing remove/leave behavior without changing unrelated member actions.

### Transfer dialog

Create a dialog component parallel to the existing workspace delete dialog pattern.

Behavior:

- local `open` state
- local `confirmation` input state
- `TRANSFER` gate for submit enablement
- mutation pending state disables submit
- spinner is shown before `Transfer ownership` while pending
- input resets when dialog closes

The design should feel like a danger-zone action without copying delete-specific text.

## Data Refresh and Client State

After success, the client should refresh the smallest set of data necessary to make the UI consistent immediately.

At minimum:

- refetch members list
- refetch any workspace lifecycle or workspace capability data that controls owner-only actions

The former owner should remain on the Members page and continue to have access expected for `admin`. No redirect is expected.

## Billing Behavior

No billing plan or entitlement changes should occur when ownership transfers.

The feature must preserve the current workspace billing behavior because the billable entity is the workspace. The only user-facing billing note is the warning that Stripe payment transfer remains a manual coordination task outside the feature scope.

## Error Handling

The server should return clear errors for invalid transfer attempts.

Expected categories:

- actor lacks permission
- target member not found
- transfer target invalid
- invariant verification failure after role updates

The client should show a generic destructive-action failure toast when the mutation fails, unless an explicit server message is safe and already consistent with existing patterns.

## Testing Strategy

### Unit tests

Add targeted unit tests for:

- transfer lifecycle capability evaluation in `packages/policy`
- server-side transfer guard behavior in `apps/web`
- any post-transfer invariant helper used by the server function

### Component and integration tests

Add targeted UI tests for:

- action visibility only on eligible member rows
- modal copy and `TRANSFER` confirmation gating
- cancel behavior
- loading state with spinner before `Transfer ownership`
- success toast after completion

### End-to-end verification

Add at least one Playwright e2e test covering the full browser flow:

1. owner opens the workspace Members page
2. owner opens row actions for a target member or admin
3. owner chooses `Transfer ownership`
4. modal shows the demotion, Stripe-payment, and irreversible-action warnings
5. confirm button stays disabled until `TRANSFER` is typed
6. owner submits transfer and sees pending loading state
7. success toast appears
8. refreshed members UI shows target as `owner`
9. refreshed members UI shows original owner as `admin`
10. only one owner remains visible in the members list

### Playwright execution note

When executing the Playwright e2e test from Codex, the browser run must occur outside the Codex sandbox. This should be called out explicitly during implementation verification so there is no ambiguity when the test is run.

## Risks

### Partial update risk

Because the role transfer is composed from two underlying role updates, the biggest implementation risk is leaving the workspace in an invalid intermediate state if one update succeeds and the second fails.

Mitigation:

- keep the logic in one server function
- re-read and verify the final owner/admin state before reporting success
- prefer the smallest possible code path around the update sequence

### UI capability drift

If client queries are not refreshed after transfer, the former owner may continue seeing stale owner-only controls.

Mitigation:

- explicitly refetch member data
- explicitly invalidate capability/lifecycle data consumed by the route

## Definition of Done

SF-9 is complete when all of the following are true:

- current owner can initiate transfer from the Members table
- confirmation modal matches the approved flow
- `TRANSFER` is required before confirmation
- loading and success states behave as specified
- server enforces target eligibility and actor authority
- successful transfer results in exactly one owner
- original owner becomes admin after success
- billing remains unchanged
- unit/component coverage exists for the transfer behavior
- a Playwright e2e test covers the full transfer flow
- verification notes explicitly mention that Playwright must run outside the Codex sandbox
