# SF-24 Membership Confirmation Dialog Design

**Date:** 2026-04-06
**Goal:** Add a confirmation modal before destructive workspace membership exits, requiring the user to type `REMOVE` before either removing another member or leaving the workspace.
**Approach:** Introduce a small reusable typed-confirmation dialog component in `apps/web`, reuse it for workspace member removal, workspace leave, and the existing workspace delete flow, and keep feature-specific mutation logic in each consuming component.
**Scope exclusion:** This design does not change workspace lifecycle policy rules, server-side authorization, or the underlying member/delete mutations.

---

## 1. Context

The current workspace members UI exposes destructive actions from the row actions dropdown in [`apps/web/src/components/workspace/workspace-members-table.tsx`](/Users/sfung/.codex/worktrees/25cd/sass-starter-template/apps/web/src/components/workspace/workspace-members-table.tsx).

Today:

- choosing `Remove` immediately calls `onRemoveMember(id)`,
- choosing `Leave` immediately calls `onLeave()`,
- there is no typed confirmation step before access is removed.

The repo already uses a stronger destructive-action pattern for workspace deletion in [`apps/web/src/components/workspace/workspace-delete-dialog.tsx`](/Users/sfung/.codex/worktrees/25cd/sass-starter-template/apps/web/src/components/workspace/workspace-delete-dialog.tsx):

- an `AlertDialog`,
- destructive styling,
- a required typed confirmation token,
- a disabled confirm button until the token matches.

SF-24 should bring the members flow up to that same safety bar and avoid creating another one-off destructive dialog implementation.

## 2. Problem

Removing a member or leaving a workspace is currently too easy to do accidentally because the action executes directly from the dropdown menu.

That creates two UX issues:

1. destructive actions have no confirmation barrier,
2. the members flow and the workspace delete flow use inconsistent destructive-action patterns.

## 3. Objectives

1. Require a confirmation modal before `Remove` and `Leave`.
2. Require an action-specific typed confirmation token before confirming either action.
3. Use copy that clearly distinguishes removing another user from leaving the workspace himself.
4. Extract the typed-confirmation UI so the existing workspace delete flow can use the same dialog primitive.
5. Keep mutations, redirects, and toasts owned by the feature that triggers the dialog.

## 4. Recommended Design

Create a shared typed destructive confirmation component in `apps/web/src/components/` and use it in three places:

- workspace member `Remove`,
- workspace `Leave`,
- workspace `Delete Workspace`.

This shared component should only own generic dialog behavior:

- `open` / `onOpenChange`,
- alert dialog structure,
- confirmation token input,
- disabled confirm state until token matches,
- pending state on the confirm button,
- resetting typed input when the dialog closes.

It should not own business behavior such as:

- member removal mutations,
- leave mutations,
- workspace deletion redirect logic,
- success or error toast messages.

That business behavior stays with the existing feature components and hooks.

## 5. Proposed Component Boundary

Add a reusable component with a narrow API:

### `apps/web/src/components/shared/typed-confirm-dialog.tsx`

Required props:

```ts
type TypedConfirmDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: React.ReactNode;
  description: React.ReactNode;
  confirmLabel: string;
  confirmationText: string;
  isPending?: boolean;
  confirmVariant?: 'default' | 'destructive';
  onConfirm: () => void | Promise<void>;
};
```

Behavior:

- render `AlertDialog` primitives from `@workspace/ui/components/alert-dialog`,
- render an input with `confirmationText` as the placeholder,
- enable the confirm button only when the typed value exactly matches `confirmationText`,
- clear the input whenever the dialog closes,
- keep the dialog open if `onConfirm` fails so the feature owner can show an error toast without losing context.

Optional props:

- default `confirmationText` to `DELETE` or require it explicitly,
- default `confirmVariant` to `destructive`,
- accept optional `icon` / `media` content if needed.

This component should stay focused on typed destructive confirmation only. It should not become a universal dialog abstraction.

## 6. Member Flow Changes

### `apps/web/src/components/workspace/workspace-members-table.tsx`

Add controlled dialog state for the pending action selected from the row menu.

Local state shape:

```ts
type PendingMembershipAction =
  | { kind: 'remove'; memberId: string; email: string }
  | { kind: 'leave' };
```

Behavior:

1. Clicking `Remove` opens the confirmation dialog with a `remove` payload instead of calling `onRemoveMember` directly.
2. Clicking `Leave` opens the same confirmation dialog with a `leave` payload instead of calling `onLeave` directly.
3. Confirming the dialog calls the existing callback for the selected action.
4. While the relevant mutation is pending, the confirm button is disabled and shows the existing loading state.
5. Closing the dialog clears the pending action.

### Dialog copy

For removing another member:

- Title: `Remove member`
- Description: `This will remove <email> from the workspace. The user will lose access immediately.`
- Confirmation token: `REMOVE`
- Confirm button: `Confirm remove`

For leaving the workspace:

- Title: `Leave workspace`
- Description: `This will remove your access to this workspace immediately.`
- Confirmation token: `LEAVE`
- Confirm button: `Confirm leave`

## 7. Workspace Delete Reuse

### `apps/web/src/components/workspace/workspace-delete-dialog.tsx`

Refactor the existing workspace delete component to use the new shared typed-confirmation dialog internally.

What stays the same:

- trigger button label and styling,
- `DELETE` as the required typed token,
- delete mutation behavior,
- success toast,
- active-workspace switching,
- redirect to the next workspace,
- error handling.

What changes:

- the dialog body structure is delegated to the shared typed-confirmation component,
- workspace-delete-specific copy is passed as props instead of being hardcoded into a one-off dialog implementation.

This keeps the proven delete behavior intact while consolidating the typed-confirmation UI pattern.

## 8. Why This Boundary Is Preferred

### Option A: one shared typed-confirmation dialog

Recommended.

Benefits:

- real reuse across at least two current consumers,
- consistent destructive UX,
- small and testable abstraction,
- avoids duplicating input-reset and disabled-confirm behavior.

Tradeoff:

- requires a small refactor of the existing workspace delete component.

### Option B: separate custom dialogs for remove/leave/delete

Rejected because:

- duplicates behavior already present in delete,
- increases maintenance and test surface,
- makes future destructive flows more likely to drift.

### Option C: inline confirmation inside the dropdown menu

Rejected because:

- typed confirmation is awkward inside menus,
- accessibility is weaker,
- it conflicts with the repo’s existing `AlertDialog` destructive pattern.

## 9. Files Expected To Change

Primary:

- `apps/web/src/components/workspace/workspace-members-table.tsx`
- `apps/web/src/components/workspace/workspace-delete-dialog.tsx`
- `apps/web/src/components/shared/typed-confirm-dialog.tsx`

Tests:

- `apps/web/test/integration/components/workspace/workspace-members-flow.integration.test.tsx`
- `apps/web/test/unit/components/workspace/workspace-members-table.test.tsx`
- `apps/web/test/unit/components/workspace/workspace-delete-dialog.test.tsx`

If the shared component is tested directly:

- `apps/web/test/unit/components/shared/typed-confirm-dialog.test.tsx`

## 10. Verification Plan

Start with the smallest meaningful checks:

1. targeted unit/integration tests for the members table flow,
2. targeted unit tests for the workspace delete dialog regression surface,
3. typecheck for `@workspace/web` if the new shared component changes prop wiring across files.

Minimum expected behavioral coverage:

- `Remove` opens a dialog instead of immediately calling `onRemoveMember`,
- `Leave` opens a dialog instead of immediately calling `onLeave`,
- the remove confirm button stays disabled until `REMOVE` is typed,
- the leave confirm button stays disabled until `LEAVE` is typed,
- confirming `Remove` calls `onRemoveMember(memberId)`,
- confirming `Leave` calls `onLeave()`,
- closing either dialog resets the input,
- workspace delete still requires `DELETE`,
- workspace delete still performs the same success and failure behaviors after the shared-dialog refactor.

## 11. Not Changed

- No changes to `apps/web/src/workspace/use-members-table.ts` mutation ownership.
- No changes to server functions in `workspace-members.functions.ts`.
- No changes to lifecycle policy or capability checks.
- No changes to the dropdown menu permissions that decide whether `Remove` or `Leave` is shown.

## 12. Open Decisions Resolved

The following decisions are now explicit for implementation:

- typed confirmation is required for both `Remove` and `Leave`,
- `Remove` uses the `REMOVE` token and `Leave` uses the `LEAVE` token,
- the member-removal description uses `The user will lose access immediately.`,
- the reusable boundary is the typed-confirmation dialog UI, not the feature-specific mutation wrapper,
- workspace delete should be migrated to the shared dialog primitive in the same implementation slice.
