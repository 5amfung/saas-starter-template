# SF-24 Membership Confirmation Dialog Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add typed confirmation dialogs before workspace member removal and workspace leave, and reuse the same typed-confirmation primitive for workspace deletion.

**Architecture:** Build a focused `TypedConfirmDialog` component in `apps/web` that owns only generic destructive-confirmation UI behavior. Then integrate it into the members table for `Remove` and `Leave`, and refactor the existing workspace delete dialog to consume the same shared component while preserving its existing mutation, toast, and redirect behavior.

**Tech Stack:** React 19, TanStack Query, Testing Library, Vitest, `@workspace/ui` AlertDialog primitives, `pnpm`

---

## File Map

- Create: `apps/web/src/components/shared/typed-confirm-dialog.tsx`
- Modify: `apps/web/src/components/workspace/workspace-members-table.tsx`
- Modify: `apps/web/src/components/workspace/workspace-delete-dialog.tsx`
- Create: `apps/web/test/unit/components/shared/typed-confirm-dialog.test.tsx`
- Modify: `apps/web/test/integration/components/workspace/workspace-members-flow.integration.test.tsx`
- Modify: `apps/web/test/unit/components/workspace/workspace-members-table.test.tsx`
- Modify: `apps/web/test/unit/components/workspace/workspace-delete-dialog.test.tsx`

The new shared component owns only dialog UI state local to the confirmation input. Member-removal and workspace-delete business behavior stays in their existing feature components.

### Task 1: Add failing tests for the shared typed-confirmation dialog

**Files:**

- Create: `apps/web/test/unit/components/shared/typed-confirm-dialog.test.tsx`
- Reference: `apps/web/src/components/workspace/workspace-delete-dialog.tsx`

- [ ] **Step 1: Write the failing unit tests for the shared dialog**

```tsx
// @vitest-environment jsdom
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@workspace/test-utils';
import { TypedConfirmDialog } from '@/components/shared/typed-confirm-dialog';

describe('TypedConfirmDialog', () => {
  it('disables confirm until the token matches exactly', async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();

    renderWithProviders(
      <TypedConfirmDialog
        open={true}
        onOpenChange={onOpenChange}
        title="Remove member"
        description="Confirm member removal"
        confirmLabel="Confirm remove"
        confirmationText="REMOVE"
        onConfirm={vi.fn()}
      />
    );

    const confirmButton = screen.getByRole('button', {
      name: /confirm remove/i,
    });

    expect(confirmButton).toBeDisabled();

    await user.type(screen.getByPlaceholderText('REMOVE'), 'REMOV');
    expect(confirmButton).toBeDisabled();

    await user.type(screen.getByPlaceholderText('REMOVE'), 'E');
    expect(confirmButton).not.toBeDisabled();
  });

  it('clears the typed value when the dialog closes and reopens', async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();

    const { rerender } = renderWithProviders(
      <TypedConfirmDialog
        open={true}
        onOpenChange={onOpenChange}
        title="Leave workspace"
        description="Confirm leaving"
        confirmLabel="Confirm leave"
        confirmationText="LEAVE"
        onConfirm={vi.fn()}
      />
    );

    const input = screen.getByPlaceholderText('LEAVE');
    await user.type(input, 'LEAVE');
    expect(input).toHaveValue('LEAVE');

    rerender(
      <TypedConfirmDialog
        open={false}
        onOpenChange={onOpenChange}
        title="Leave workspace"
        description="Confirm leaving"
        confirmLabel="Confirm leave"
        confirmationText="LEAVE"
        onConfirm={vi.fn()}
      />
    );

    rerender(
      <TypedConfirmDialog
        open={true}
        onOpenChange={onOpenChange}
        title="Leave workspace"
        description="Confirm leaving"
        confirmLabel="Confirm leave"
        confirmationText="LEAVE"
        onConfirm={vi.fn()}
      />
    );

    expect(screen.getByPlaceholderText('LEAVE')).toHaveValue('');
  });

  it('calls onConfirm only after the token is valid', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();

    renderWithProviders(
      <TypedConfirmDialog
        open={true}
        onOpenChange={vi.fn()}
        title="Delete workspace"
        description="Confirm delete"
        confirmLabel="Confirm delete"
        confirmationText="DELETE"
        onConfirm={onConfirm}
      />
    );

    await user.type(screen.getByPlaceholderText('DELETE'), 'DELETE');
    await user.click(screen.getByRole('button', { name: /confirm delete/i }));

    expect(onConfirm).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run the new shared-dialog test file and verify it fails**

Run:

```bash
pnpm --filter @workspace/web test apps/web/test/unit/components/shared/typed-confirm-dialog.test.tsx
```

Expected:

```text
FAIL  apps/web/test/unit/components/shared/typed-confirm-dialog.test.tsx
Error: Failed to resolve import "@/components/shared/typed-confirm-dialog"
```

- [ ] **Step 3: Implement the minimal shared dialog component**

```tsx
import * as React from 'react';
import { IconAlertTriangle, IconLoader2 } from '@tabler/icons-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from '@workspace/ui/components/alert-dialog';
import { Input } from '@workspace/ui/components/input';

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

export function TypedConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  confirmationText,
  isPending = false,
  confirmVariant = 'destructive',
  onConfirm,
}: TypedConfirmDialogProps) {
  const [value, setValue] = React.useState('');
  const isConfirmed = value === confirmationText;

  React.useEffect(() => {
    if (!open) setValue('');
  }, [open]);

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogMedia className="bg-destructive/10">
            <IconAlertTriangle className="text-destructive" />
          </AlertDialogMedia>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>

        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium" htmlFor="typed-confirm-input">
            Type <strong>{confirmationText}</strong> to confirm
          </label>
          <Input
            id="typed-confirm-input"
            value={value}
            onChange={(event) => setValue(event.target.value)}
            placeholder={confirmationText}
            autoComplete="off"
          />
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            variant={confirmVariant}
            disabled={!isConfirmed || isPending}
            onClick={(event) => {
              event.preventDefault();
              void onConfirm();
            }}
          >
            {isPending ? <IconLoader2 className="size-4 animate-spin" /> : null}
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
```

- [ ] **Step 4: Re-run the shared-dialog tests and verify they pass**

Run:

```bash
pnpm --filter @workspace/web test apps/web/test/unit/components/shared/typed-confirm-dialog.test.tsx
```

Expected:

```text
PASS  apps/web/test/unit/components/shared/typed-confirm-dialog.test.tsx
```

- [ ] **Step 5: Commit the shared dialog foundation**

```bash
git add apps/web/src/components/shared/typed-confirm-dialog.tsx apps/web/test/unit/components/shared/typed-confirm-dialog.test.tsx
git commit -m "test(web): add typed confirmation dialog"
```

### Task 2: Add failing tests for member remove and leave confirmation

**Files:**

- Modify: `apps/web/test/integration/components/workspace/workspace-members-flow.integration.test.tsx`
- Modify: `apps/web/test/unit/components/workspace/workspace-members-table.test.tsx`
- Reference: `apps/web/src/components/workspace/workspace-members-table.tsx`

- [ ] **Step 1: Update integration tests so remove and leave require confirmation**

Add or replace the direct-callback assertions with tests like:

```tsx
it('opens a remove confirmation dialog before removing a member', async () => {
  const user = userEvent.setup();
  renderWithProviders(<WorkspaceMembersTable {...defaultProps} />);

  const actionButtons = screen.getAllByRole('button', { name: /row actions/i });
  await user.click(actionButtons[1]);
  await user.click(await screen.findByRole('menuitem', { name: /remove/i }));

  expect(
    screen.getByRole('heading', { name: /remove member/i })
  ).toBeInTheDocument();
  expect(defaultProps.onRemoveMember).not.toHaveBeenCalled();
});

it('confirms member removal only after typing REMOVE', async () => {
  const user = userEvent.setup();
  renderWithProviders(<WorkspaceMembersTable {...defaultProps} />);

  const actionButtons = screen.getAllByRole('button', { name: /row actions/i });
  await user.click(actionButtons[1]);
  await user.click(await screen.findByRole('menuitem', { name: /remove/i }));

  const confirmButton = screen.getByRole('button', {
    name: /confirm remove/i,
  });
  expect(confirmButton).toBeDisabled();

  await user.type(screen.getByPlaceholderText('REMOVE'), 'REMOVE');
  await user.click(confirmButton);

  expect(defaultProps.onRemoveMember).toHaveBeenCalledWith('mem-2');
});

it('confirms leaving only after typing LEAVE', async () => {
  const user = userEvent.setup();
  renderWithProviders(
    <WorkspaceMembersTable
      {...defaultProps}
      currentUserId="user-2"
      workspaceRole="member"
      canLeaveWorkspace={true}
      canManageMembers={false}
    />
  );

  const actionButtons = screen.getAllByRole('button', { name: /row actions/i });
  await user.click(actionButtons[1]);
  await user.click(await screen.findByRole('menuitem', { name: /leave/i }));

  const confirmButton = screen.getByRole('button', {
    name: /confirm leave/i,
  });
  expect(confirmButton).toBeDisabled();

  await user.type(screen.getByPlaceholderText('LEAVE'), 'LEAVE');
  await user.click(confirmButton);

  expect(defaultProps.onLeave).toHaveBeenCalledTimes(1);
});
```

- [ ] **Step 2: Run the members integration tests to verify they fail before implementation**

Run:

```bash
pnpm --filter @workspace/web test apps/web/test/integration/components/workspace/workspace-members-flow.integration.test.tsx
```

Expected:

```text
FAIL  ...workspace-members-flow.integration.test.tsx
Expected heading "Remove member" to be in the document
```

- [ ] **Step 3: Implement dialog state and integration in the members table**

In `apps/web/src/components/workspace/workspace-members-table.tsx`, add:

```tsx
type PendingMembershipAction =
  | { kind: 'remove'; memberId: string; email: string }
  | { kind: 'leave' };

const [pendingAction, setPendingAction] =
  React.useState<PendingMembershipAction | null>(null);

const isRemoveAction = pendingAction?.kind === 'remove';
const isLeaveAction = pendingAction?.kind === 'leave';
const dialogOpen = pendingAction !== null;
```

Use the menu handlers:

```tsx
onClick={() =>
  setPendingAction({
    kind: 'remove',
    memberId: id,
    email: row.original.email,
  })
}
```

```tsx
onClick={() => setPendingAction({ kind: 'leave' })}
```

Render the shared dialog once near the table root:

```tsx
<TypedConfirmDialog
  open={dialogOpen}
  onOpenChange={(open) => {
    if (!open) setPendingAction(null);
  }}
  title={isRemoveAction ? 'Remove member' : 'Leave workspace'}
  description={
    isRemoveAction ? (
      <>
        This will remove <strong>{pendingAction?.email}</strong> from the
        workspace. The user will lose access immediately.
      </>
    ) : (
      'This will remove your access to this workspace immediately.'
    )
  }
  confirmLabel={isRemoveAction ? 'Confirm remove' : 'Confirm leave'}
  confirmationText={isRemoveAction ? 'REMOVE' : 'LEAVE'}
  isPending={
    isRemoveAction
      ? removingMemberId === pendingAction?.memberId
      : leavingWorkspace
  }
  onConfirm={async () => {
    if (pendingAction?.kind === 'remove') {
      await onRemoveMember(pendingAction.memberId);
      setPendingAction(null);
      return;
    }

    if (pendingAction?.kind === 'leave') {
      await onLeave();
      setPendingAction(null);
    }
  }}
/>
```

- [ ] **Step 4: Re-run the members integration tests and verify they pass**

Run:

```bash
pnpm --filter @workspace/web test apps/web/test/integration/components/workspace/workspace-members-flow.integration.test.tsx
```

Expected:

```text
PASS  apps/web/test/integration/components/workspace/workspace-members-flow.integration.test.tsx
```

- [ ] **Step 5: Commit the members-flow confirmation change**

```bash
git add apps/web/src/components/workspace/workspace-members-table.tsx apps/web/test/integration/components/workspace/workspace-members-flow.integration.test.tsx apps/web/test/unit/components/workspace/workspace-members-table.test.tsx
git commit -m "feat(web): confirm workspace membership exits"
```

### Task 3: Refactor workspace delete to reuse the shared dialog

**Files:**

- Modify: `apps/web/src/components/workspace/workspace-delete-dialog.tsx`
- Modify: `apps/web/test/unit/components/workspace/workspace-delete-dialog.test.tsx`
- Reference: `apps/web/src/components/shared/typed-confirm-dialog.tsx`

- [ ] **Step 1: Keep the existing delete tests, then add one regression assertion for shared behavior if needed**

If coverage is still missing, add:

```tsx
it('still requires DELETE after the shared dialog refactor', async () => {
  const user = userEvent.setup();
  renderWithProviders(<WorkspaceDeleteDialog {...defaultProps} />);

  await user.click(screen.getByRole('button', { name: /delete workspace/i }));

  const confirmButton = screen.getByRole('button', {
    name: /confirm delete/i,
  });
  expect(confirmButton).toBeDisabled();

  await user.type(screen.getByPlaceholderText('DELETE'), 'DELETE');
  expect(confirmButton).not.toBeDisabled();
});
```

- [ ] **Step 2: Run the delete-dialog unit tests as a safety baseline**

Run:

```bash
pnpm --filter @workspace/web test apps/web/test/unit/components/workspace/workspace-delete-dialog.test.tsx
```

Expected:

```text
PASS  apps/web/test/unit/components/workspace/workspace-delete-dialog.test.tsx
```

- [ ] **Step 3: Refactor the workspace delete component to use `TypedConfirmDialog`**

Replace the inline dialog content in `workspace-delete-dialog.tsx` with:

```tsx
<TypedConfirmDialog
  open={open}
  onOpenChange={setOpen}
  title="Delete Workspace"
  description={
    <>
      This will permanently delete <strong>{workspaceName}</strong> and all
      associated workspace data. This action cannot be undone.
    </>
  }
  confirmLabel="Confirm delete"
  confirmationText="DELETE"
  isPending={deleteMutation.isPending}
  onConfirm={() => deleteMutation.mutateAsync()}
/>
```

Keep the outer trigger button in `WorkspaceDeleteDialog` so the current public API and layout remain unchanged.

- [ ] **Step 4: Re-run the delete-dialog tests and verify they still pass**

Run:

```bash
pnpm --filter @workspace/web test apps/web/test/unit/components/workspace/workspace-delete-dialog.test.tsx
```

Expected:

```text
PASS  apps/web/test/unit/components/workspace/workspace-delete-dialog.test.tsx
```

- [ ] **Step 5: Commit the workspace-delete refactor**

```bash
git add apps/web/src/components/workspace/workspace-delete-dialog.tsx apps/web/test/unit/components/workspace/workspace-delete-dialog.test.tsx
git commit -m "refactor(web): reuse typed confirmation dialog"
```

### Task 4: Run focused verification and capture final readiness

**Files:**

- Verify only: `apps/web/src/components/shared/typed-confirm-dialog.tsx`
- Verify only: `apps/web/src/components/workspace/workspace-members-table.tsx`
- Verify only: `apps/web/src/components/workspace/workspace-delete-dialog.tsx`

- [ ] **Step 1: Run the focused workspace/component test suite**

Run:

```bash
pnpm --filter @workspace/web test apps/web/test/unit/components/shared/typed-confirm-dialog.test.tsx apps/web/test/unit/components/workspace/workspace-delete-dialog.test.tsx apps/web/test/unit/components/workspace/workspace-members-table.test.tsx apps/web/test/integration/components/workspace/workspace-members-flow.integration.test.tsx
```

Expected:

```text
PASS  apps/web/test/unit/components/shared/typed-confirm-dialog.test.tsx
PASS  apps/web/test/unit/components/workspace/workspace-delete-dialog.test.tsx
PASS  apps/web/test/unit/components/workspace/workspace-members-table.test.tsx
PASS  apps/web/test/integration/components/workspace/workspace-members-flow.integration.test.tsx
```

- [ ] **Step 2: Run web typecheck if any prop or JSX typing changed unexpectedly**

Run:

```bash
pnpm --filter @workspace/web typecheck
```

Expected:

```text
No TypeScript errors
```

- [ ] **Step 3: Review the final diff for scope control**

Run:

```bash
git diff -- apps/web/src/components/shared/typed-confirm-dialog.tsx apps/web/src/components/workspace/workspace-members-table.tsx apps/web/src/components/workspace/workspace-delete-dialog.tsx apps/web/test/unit/components/shared/typed-confirm-dialog.test.tsx apps/web/test/unit/components/workspace/workspace-delete-dialog.test.tsx apps/web/test/unit/components/workspace/workspace-members-table.test.tsx apps/web/test/integration/components/workspace/workspace-members-flow.integration.test.tsx
```

Expected:

```text
Only the shared confirmation dialog, its consumers, and their targeted tests are changed.
```

- [ ] **Step 4: Commit the verification checkpoint**

```bash
git add apps/web/src/components/shared/typed-confirm-dialog.tsx apps/web/src/components/workspace/workspace-members-table.tsx apps/web/src/components/workspace/workspace-delete-dialog.tsx apps/web/test/unit/components/shared/typed-confirm-dialog.test.tsx apps/web/test/unit/components/workspace/workspace-delete-dialog.test.tsx apps/web/test/unit/components/workspace/workspace-members-table.test.tsx apps/web/test/integration/components/workspace/workspace-members-flow.integration.test.tsx
git commit -m "test(web): verify destructive confirmation flows"
```

## Self-Review

Spec coverage:

- Shared typed-confirmation dialog: covered by Task 1 and Task 3.
- Remove and Leave confirmation with action-specific tokens: covered by Task 2.
- Workspace delete reuse: covered by Task 3.
- Focused verification expectations: covered by Task 4.

Placeholder scan:

- No `TODO`, `TBD`, or deferred “write tests later” language remains.
- Each testing step includes an exact command and expected outcome.

Type consistency:

- Shared component is named `TypedConfirmDialog` throughout.
- Member tokens are `REMOVE` and `LEAVE`, delete token is `DELETE` throughout.
- Feature-owned callbacks remain `onRemoveMember`, `onLeave`, and `onDelete`.

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-04-06-sf-24-membership-confirmation-dialog.md`. Two execution options:

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

Which approach?
