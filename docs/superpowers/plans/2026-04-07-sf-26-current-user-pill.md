# SF-26 Current User Pill Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `Current user` badge immediately after the signed-in user's email in the workspace Members table.

**Architecture:** Keep the feature entirely in the `apps/web` presentation layer. Derive whether a row belongs to the signed-in user inside the members table email cell using existing `currentUserId` and `row.original.userId`, and verify the behavior with focused component tests.

**Tech Stack:** React 19, TanStack Table, Vitest, Testing Library, shared `@workspace/ui` Badge primitive, pnpm

---

## File Map

- Modify: `apps/web/src/components/workspace/workspace-members-table.tsx`
  - Update the Email Address column cell to render email text plus a conditional `Current user` badge.
- Modify: `apps/web/test/unit/components/workspace/workspace-members-table.test.tsx`
  - Add or refine focused assertions covering badge visibility for current-user and non-current-user rows.
- Do not modify: `apps/web/src/workspace/use-members-table.ts`
  - The hook already provides the required `currentUserId` and member `userId` values.

### Task 1: Add a focused failing component test

**Files:**

- Modify: `apps/web/test/unit/components/workspace/workspace-members-table.test.tsx`
- Test: `apps/web/test/unit/components/workspace/workspace-members-table.test.tsx`

- [ ] **Step 1: Add a test that expects the badge on the signed-in user row**

Add a new test near the existing rendering tests:

```tsx
it('renders a Current user badge next to the signed-in member email only', () => {
  const members = [
    createMockMemberRow({
      id: 'member-1',
      userId: 'user-1',
      email: 'me@example.com',
      role: 'owner',
    }),
    createMockMemberRow({
      id: 'member-2',
      userId: 'user-2',
      email: 'other@example.com',
      role: 'member',
    }),
  ];

  render(
    <WorkspaceMembersTable
      {...defaultProps}
      data={members}
      total={2}
      currentUserId="user-1"
    />
  );

  expect(screen.getByText('me@example.com')).toBeInTheDocument();
  expect(screen.getByText('Current user')).toBeInTheDocument();
  expect(screen.getByText('other@example.com')).toBeInTheDocument();
  expect(screen.getAllByText('Current user')).toHaveLength(1);
});
```

- [ ] **Step 2: Run the targeted test to verify it fails before implementation**

Run:

```bash
pnpm --filter @workspace/web test test/unit/components/workspace/workspace-members-table.test.tsx
```

Expected:

- the new test fails because `Current user` is not rendered yet,
- existing members table tests continue to run.

### Task 2: Implement the email-cell badge

**Files:**

- Modify: `apps/web/src/components/workspace/workspace-members-table.tsx`
- Test: `apps/web/test/unit/components/workspace/workspace-members-table.test.tsx`

- [ ] **Step 1: Import the shared Badge primitive**

Add this import with the existing `@workspace/ui` imports:

```tsx
import { Badge } from '@workspace/ui/components/badge';
```

- [ ] **Step 2: Replace the plain email cell with an inline email-plus-badge layout**

Update the email column definition from:

```tsx
        cell: ({ row }) => row.original.email,
```

to:

```tsx
        cell: ({ row }) => {
          const isCurrentUserRow = row.original.userId === currentUserId;

          return (
            <div className="inline-flex items-center gap-2">
              <span>{row.original.email}</span>
              {isCurrentUserRow ? (
                <Badge variant="secondary">Current user</Badge>
              ) : null}
            </div>
          );
        },
```

Keep the rest of the column definition unchanged:

- `accessorKey` remains `email`,
- sorting remains enabled,
- no changes to row actions, role cells, or pagination behavior.

- [ ] **Step 3: Sanity-check the closure dependencies for the memoized columns**

Because the email cell now reads `currentUserId`, confirm that `currentUserId` remains in the `useMemo` dependency array for `columns`.

Expected final dependency list continues to include:

```tsx
[
  canManageMembers,
  currentUserId,
  canLeaveWorkspace,
  isLoading,
  leavingWorkspace,
  setTransferTarget,
  removingMemberId,
  workspaceRole,
];
```

### Task 3: Verify and close out

**Files:**

- Modify: `apps/web/test/unit/components/workspace/workspace-members-table.test.tsx`
- Modify: `apps/web/src/components/workspace/workspace-members-table.tsx`

- [ ] **Step 1: Run the targeted members table test file**

Run:

```bash
pnpm --filter @workspace/web test test/unit/components/workspace/workspace-members-table.test.tsx
```

Expected:

- the new `Current user` badge test passes,
- the pre-existing members table tests still pass,
- no hook, policy, or server tests are required because behavior is local to the table component.

- [ ] **Step 2: Review the rendered-behavior contract in code**

Confirm the final behavior in the changed files:

- [`apps/web/src/components/workspace/workspace-members-table.tsx`](/Users/sfung/.codex/worktrees/7f79/sass-starter-template/apps/web/src/components/workspace/workspace-members-table.tsx)
  - Email cell renders the email text for every row.
  - Badge text is exactly `Current user`.
  - Badge appears only when `row.original.userId === currentUserId`.
- [`apps/web/test/unit/components/workspace/workspace-members-table.test.tsx`](/Users/sfung/.codex/worktrees/7f79/sass-starter-template/apps/web/test/unit/components/workspace/workspace-members-table.test.tsx)
  - Test coverage asserts the badge is shown exactly once for a mixed current-user/non-current-user dataset.

- [ ] **Step 3: Commit the implementation**

Run:

```bash
git add apps/web/src/components/workspace/workspace-members-table.tsx apps/web/test/unit/components/workspace/workspace-members-table.test.tsx
git commit -m "feat(web): add current user badge to workspace members"
```

Expected:

- only the component and its test are included,
- commit message follows Conventional Commits.

## Self-Review

Spec coverage check:

- Badge placement after email is covered in Task 2.
- Shared badge reuse is covered in Task 2 Step 1.
- Non-goals are preserved by explicitly leaving `use-members-table.ts` and server/policy layers untouched.
- Verification requirement is covered in Task 1 Step 2 and Task 3 Step 1.

Placeholder scan:

- No `TODO`, `TBD`, or unresolved implementation placeholders remain.
- All code-editing steps include concrete snippets or exact commands.

Type consistency check:

- The plan uses the existing `currentUserId` prop and `row.original.userId` field consistently.
- Badge text is consistently `Current user`.
