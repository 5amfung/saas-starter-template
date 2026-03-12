# Plan Limit Gate Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Intercept workspace creation and member invitation with a reusable plan limit check, showing an upgrade promotion dialog instead of a cryptic error toast.

**Architecture:** A `checkPlanLimit` server function backed by shared query helpers (`countOwnedWorkspaces`, `countWorkspaceMembers`) in `billing.server.ts`. A reusable `UpgradePromptDialog` component shown when limits are exceeded. Server hooks refactored to use the same shared helpers as defense-in-depth.

**Tech Stack:** TanStack Start server functions, Drizzle ORM, React, shadcn/ui AlertDialog, Stripe checkout integration.

**Design doc:** `docs/plans/2026-03-12-plan-limit-gate-design.md`

---

### Task 1: Add shared query helpers to `billing.server.ts`

**Files:**

- Modify: `src/billing/billing.server.ts`

**Step 1: Add `countOwnedWorkspaces` helper**

Add these imports at the top of `billing.server.ts` (alongside existing imports):

```ts
import { count, and, eq } from 'drizzle-orm';
import { db } from '@/db';
import { member as memberTable } from '@/db/schema';
```

Add after `getUserPlanLimits`:

```ts
/**
 * Counts the number of workspaces where the user is an owner.
 * Used by both the plan limit check and the org creation hook.
 */
export async function countOwnedWorkspaces(userId: string): Promise<number> {
  const [result] = await db
    .select({ count: count() })
    .from(memberTable)
    .where(and(eq(memberTable.userId, userId), eq(memberTable.role, 'owner')));
  return result.count;
}
```

**Step 2: Add `countWorkspaceMembers` helper**

Add after `countOwnedWorkspaces`:

```ts
/**
 * Counts the number of members in a workspace.
 * Used by both the plan limit check and the invitation hook.
 */
export async function countWorkspaceMembers(
  workspaceId: string,
): Promise<number> {
  const [result] = await db
    .select({ count: count() })
    .from(memberTable)
    .where(eq(memberTable.organizationId, workspaceId));
  return result.count;
}
```

**Step 3: Verify**

Run: `bun run typecheck`
Expected: No errors.

**Step 4: Commit**

```
feat(billing): add shared query helpers for workspace and member counts
```

---

### Task 2: Add `checkPlanLimit` server function

**Files:**

- Modify: `src/billing/billing.functions.ts`

**Step 1: Add the server function**

Add these imports (some may already exist — only add what's missing):

```ts
import {
  requireVerifiedSession,
  getUserActivePlanId,
  countOwnedWorkspaces,
  countWorkspaceMembers,
} from '@/billing/billing.server';
import { getPlanById, getPlanLimitsForPlanId } from '@/billing/plans';
```

Add the input schema and server function after the existing exports:

```ts
const checkPlanLimitInput = z.object({
  feature: z.enum(['workspace', 'member']),
  workspaceId: z.string().optional(),
});

/**
 * Checks whether the current user can perform a plan-limited action.
 * Returns usage info for the UI to display in the upgrade prompt.
 */
export const checkPlanLimit = createServerFn()
  .inputValidator(checkPlanLimitInput)
  .handler(async ({ data }) => {
    const session = await requireVerifiedSession();
    const userId = session.user.id;
    const planId = await getUserActivePlanId(userId);
    const limits = getPlanLimitsForPlanId(planId);
    const planName = getPlanById(planId)?.name ?? 'Free';

    if (data.feature === 'workspace') {
      const limit = limits.maxWorkspaces;
      if (limit === -1) {
        return { allowed: true, current: 0, limit: -1, planName };
      }
      const current = await countOwnedWorkspaces(userId);
      return { allowed: current < limit, current, limit, planName };
    }

    if (data.feature === 'member') {
      if (!data.workspaceId) {
        throw new Error('workspaceId is required for member limit check.');
      }
      const limit = limits.maxMembersPerWorkspace;
      if (limit === -1) {
        return { allowed: true, current: 0, limit: -1, planName };
      }
      const current = await countWorkspaceMembers(data.workspaceId);
      return { allowed: current < limit, current, limit, planName };
    }

    return { allowed: true, current: 0, limit: -1, planName };
  });
```

**Step 2: Verify**

Run: `bun run typecheck && bun run lint -- src/billing/billing.functions.ts`
Expected: No errors.

**Step 3: Commit**

```
feat(billing): add checkPlanLimit server function for pre-flight limit checks
```

---

### Task 3: Refactor server hooks to use shared helpers

**Files:**

- Modify: `src/auth/auth.server.ts`

**Step 1: Add imports**

Add to the existing imports from `@/billing/billing.server`:

```ts
import {
  countOwnedWorkspaces,
  countWorkspaceMembers,
} from '@/billing/billing.server';
```

**Step 2: Refactor `beforeCreateOrganization`**

Replace the workspace count query block (the `if (limits.maxWorkspaces !== -1)` block) with:

```ts
if (limits.maxWorkspaces !== -1) {
  const workspaceCount = await countOwnedWorkspaces(user.id);
  if (workspaceCount >= limits.maxWorkspaces) {
    throw new APIError('FORBIDDEN', {
      message: `Your plan allows a maximum of ${limits.maxWorkspaces} workspace(s). Please upgrade to create more.`,
    });
  }
}
```

This removes the inline Drizzle query and uses the shared helper instead.

**Step 3: Refactor `beforeCreateInvitation`**

Replace the entire `beforeCreateInvitation` body with:

```ts
        beforeCreateInvitation: async ({ organization }) => {
          // Find the workspace owner to check their plan limits.
          const ownerRows = await db
            .select({ userId: memberTable.userId })
            .from(memberTable)
            .where(
              and(
                eq(memberTable.organizationId, organization.id),
                eq(memberTable.role, 'owner'),
              ),
            );
          const owner = ownerRows[0];
          if (!owner) return;

          const subs = await auth.api.listActiveSubscriptions({
            query: { referenceId: owner.userId },
          });
          const planId = resolveUserPlanId(Array.from(subs));
          const limits = getPlanLimitsForPlanId(planId);

          if (limits.maxMembersPerWorkspace !== -1) {
            const memberCount = await countWorkspaceMembers(organization.id);
            if (memberCount >= limits.maxMembersPerWorkspace) {
              throw new APIError('FORBIDDEN', {
                message: `This workspace has reached its member limit (${limits.maxMembersPerWorkspace}). The workspace owner needs to upgrade their plan.`,
              });
            }
          }
        },
```

**Step 4: Remove unused imports**

After refactoring, check if the `count` and `and` imports from `drizzle-orm` are still needed in `auth.server.ts`. The `beforeCreateOrganization` hook no longer uses `count()` directly, but `and` is still used in the owner query above. Remove `count` if unused.

**Step 5: Verify**

Run: `bun run typecheck && bun run lint -- src/auth/auth.server.ts`
Expected: No errors.

**Step 6: Commit**

```
refactor(auth): use shared billing helpers in org hooks
```

---

### Task 4: Create `UpgradePromptDialog` component

**Files:**

- Create: `src/components/billing/upgrade-prompt-dialog.tsx`

**Step 1: Create the component**

```tsx
import { IconLoader2 } from '@tabler/icons-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface UpgradePromptDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  isUpgrading: boolean;
  onUpgrade: () => void;
}

export function UpgradePromptDialog({
  open,
  onOpenChange,
  title,
  description,
  isUpgrading,
  onUpgrade,
}: UpgradePromptDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent size="sm">
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isUpgrading}>Cancel</AlertDialogCancel>
          <AlertDialogAction disabled={isUpgrading} onClick={onUpgrade}>
            {isUpgrading && <IconLoader2 className="size-4 animate-spin" />}
            Upgrade
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
```

**Step 2: Verify**

Run: `bun run typecheck && bun run lint -- src/components/billing/upgrade-prompt-dialog.tsx`
Expected: No errors.

**Step 3: Commit**

```
feat(billing): add reusable UpgradePromptDialog component
```

---

### Task 5: Gate workspace creation in `workspace-switcher.tsx`

**Files:**

- Modify: `src/components/workspace-switcher.tsx`

**Step 1: Add imports**

```ts
import { useMutation } from '@tanstack/react-query';
// useMutation is already imported — just add these:
import {
  checkPlanLimit,
  createCheckoutSession,
} from '@/billing/billing.functions';
import { UpgradePromptDialog } from '@/components/billing/upgrade-prompt-dialog';
```

**Step 2: Add upgrade dialog state and mutation**

Inside the `WorkspaceSwitcher` component, after the existing state declarations, add:

```ts
const [upgradePrompt, setUpgradePrompt] = React.useState<{
  open: boolean;
  title: string;
  description: string;
}>({ open: false, title: '', description: '' });

const upgradeMutation = useMutation({
  mutationFn: () =>
    createCheckoutSession({ data: { planId: 'pro-monthly', annual: false } }),
  onSuccess: (result) => {
    if (result.url) {
      window.location.href = result.url;
    }
  },
  onError: (error) => {
    toast.error(error.message || 'Failed to start checkout.');
  },
});
```

**Step 3: Add limit check handler**

Add a handler that checks limits before opening the create dialog:

```ts
const handleAddWorkspace = async () => {
  const result = await checkPlanLimit({ data: { feature: 'workspace' } });
  if (result.allowed) {
    setIsCreateDialogOpen(true);
  } else {
    setUpgradePrompt({
      open: true,
      title: 'Workspace limit reached',
      description: `You're using ${result.current}/${result.limit} workspaces on the ${result.planName} plan. Upgrade to create more.`,
    });
  }
};
```

**Step 4: Update the "Add workspace" click handler**

Replace the existing `onClick={() => setIsCreateDialogOpen(true)}` on the "Add workspace" `DropdownMenuItem` with:

```tsx
onClick={() => void handleAddWorkspace()}
```

**Step 5: Add the `UpgradePromptDialog` to the render tree**

Add after the existing `AlertDialog` (the create workspace dialog), before the closing `</SidebarMenu>`:

```tsx
<UpgradePromptDialog
  open={upgradePrompt.open}
  onOpenChange={(open) => setUpgradePrompt((prev) => ({ ...prev, open }))}
  title={upgradePrompt.title}
  description={upgradePrompt.description}
  isUpgrading={upgradeMutation.isPending}
  onUpgrade={() => upgradeMutation.mutate()}
/>
```

**Step 6: Verify**

Run: `bun run typecheck && bun run lint -- src/components/workspace-switcher.tsx`
Expected: No errors.

**Step 7: Manual test**

1. Sign in as a Starter (free) user.
2. Click the workspace dropdown → "Add workspace".
3. Expected: Upgrade prompt dialog appears with message "You're using 1/1 workspaces on the Starter plan. Upgrade to create more."
4. Click Cancel → dialog closes.

**Step 8: Commit**

```
feat(workspace): gate workspace creation with plan limit check and upgrade prompt
```

---

### Task 6: Gate member invitation in `members.tsx`

**Files:**

- Modify: `src/routes/_protected/ws/$workspaceId/members.tsx`

The invite dialog is triggered from `members.tsx` where `WorkspaceInviteDialog` is rendered. The `open` state comes from `useInvitationsTable` hook via `inviteDialog.open` / `inviteDialog.onOpenChange`. We need to intercept the dialog trigger (the "Invite" button).

**Step 1: Add imports**

```ts
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  checkPlanLimit,
  createCheckoutSession,
} from '@/billing/billing.functions';
import { UpgradePromptDialog } from '@/components/billing/upgrade-prompt-dialog';
```

**Step 2: Add upgrade state and mutation**

Inside `WorkspaceMembersPage`, after the existing hooks:

```ts
const [upgradePrompt, setUpgradePrompt] = React.useState<{
  open: boolean;
  title: string;
  description: string;
}>({ open: false, title: '', description: '' });

const upgradeMutation = useMutation({
  mutationFn: () =>
    createCheckoutSession({ data: { planId: 'pro-monthly', annual: false } }),
  onSuccess: (result) => {
    if (result.url) {
      window.location.href = result.url;
    }
  },
  onError: (error) => {
    toast.error(error.message || 'Failed to start checkout.');
  },
});
```

**Step 3: Add limit check handler**

```ts
const handleInviteClick = async () => {
  const result = await checkPlanLimit({
    data: { feature: 'member', workspaceId },
  });
  if (result.allowed) {
    inviteDialog.onOpenChange(true);
  } else {
    setUpgradePrompt({
      open: true,
      title: 'Member limit reached',
      description: `This workspace has ${result.current}/${result.limit} members on the ${result.planName} plan. Upgrade to invite more.`,
    });
  }
};
```

**Step 4: Replace the invite dialog trigger**

The current `WorkspaceInviteDialog` has a built-in `AlertDialogTrigger` (the "Invite" button). We need to separate the trigger from the dialog so we can intercept the click.

Replace the `{canInvite ? (` block with:

```tsx
{
  canInvite ? (
    <>
      <Button size="sm" onClick={() => void handleInviteClick()}>
        Invite
      </Button>
      <WorkspaceInviteDialog
        open={inviteDialog.open}
        onOpenChange={inviteDialog.onOpenChange}
        email={inviteDialog.draft.email}
        role={inviteDialog.draft.role}
        roles={DEFAULT_INVITE_ROLES}
        isPending={inviteDialog.isPending}
        onEmailChange={(email) =>
          inviteDialog.setDraft((current) => ({ ...current, email }))
        }
        onRoleChange={(role) =>
          inviteDialog.setDraft((current) => ({ ...current, role }))
        }
        onSubmit={() => {
          void inviteDialog.onSubmit();
        }}
      />
    </>
  ) : null;
}
```

This requires removing the `AlertDialogTrigger` from `WorkspaceInviteDialog` since the dialog is now controlled externally.

Add the `Button` import:

```ts
import { Button } from '@/components/ui/button';
```

**Step 5: Remove `AlertDialogTrigger` from `WorkspaceInviteDialog`**

In `src/components/workspace/workspace-invite-dialog.tsx`, remove the `AlertDialogTrigger` import and the trigger element. The dialog is now fully controlled by `open`/`onOpenChange` props.

Remove from imports:

```ts
  AlertDialogTrigger,
```

Remove from the render:

```tsx
<AlertDialogTrigger render={<Button size="sm">Invite</Button>} />
```

**Step 6: Add `UpgradePromptDialog` to the render tree**

Add at the end of the component return, inside the outer `<div>`:

```tsx
<UpgradePromptDialog
  open={upgradePrompt.open}
  onOpenChange={(open) => setUpgradePrompt((prev) => ({ ...prev, open }))}
  title={upgradePrompt.title}
  description={upgradePrompt.description}
  isUpgrading={upgradeMutation.isPending}
  onUpgrade={() => upgradeMutation.mutate()}
/>
```

**Step 7: Verify**

Run: `bun run typecheck && bun run lint -- src/routes/_protected/ws/\$workspaceId/members.tsx src/components/workspace/workspace-invite-dialog.tsx`
Expected: No errors.

**Step 8: Manual test**

1. Sign in as a Starter (free) user with a personal workspace (1 member).
2. Go to Members page → click "Invite".
3. Expected: Upgrade prompt dialog appears with message "This workspace has 1/1 members on the Starter plan. Upgrade to invite more."
4. Click Cancel → dialog closes.

**Step 9: Commit**

```
feat(workspace): gate member invitation with plan limit check and upgrade prompt
```

---

### Task 7: Final verification and lint

**Step 1: Run full type check and lint**

Run: `bun run typecheck && bun run lint`
Expected: No new errors from our changes.

**Step 2: Run tests**

Run: `bun test`
Expected: All existing tests pass.

**Step 3: Commit any fixes if needed**
