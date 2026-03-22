# Set Password Confirmation Dialog Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the `SetPasswordButton` with a `SetPasswordDialog` that confirms the sign-out action before sending a password reset email.

**Architecture:** Convert the existing button component into a self-contained AlertDialog following the same pattern as `ChangePasswordDialog`. The parent `account.tsx` updates its import and JSX reference.

**Tech Stack:** React 19, Base UI AlertDialog (via shadcn/ui), TanStack Query (useMutation), Better Auth client, Tabler Icons

**Spec:** `docs/superpowers/specs/2026-03-22-set-password-confirmation-dialog-design.md`

---

## Chunk 1: Implementation

### Task 1: Create SetPasswordDialog component

**Files:**

- Create: `apps/web/src/components/account/set-password-dialog.tsx`

- [ ] **Step 1: Create `set-password-dialog.tsx`**

Write the new `SetPasswordDialog` component. It follows the same pattern as `ChangePasswordDialog` but without form fields — just a confirmation message and action buttons.

```tsx
import * as React from 'react';
import { IconLoader2 } from '@tabler/icons-react';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { authClient } from '@workspace/auth/client';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@workspace/ui/components/alert-dialog';
import { Button } from '@workspace/ui/components/button';

export function SetPasswordDialog({ email }: { email: string }) {
  const [open, setOpen] = React.useState(false);

  const mutation = useMutation({
    mutationFn: async () => {
      const { error } = await authClient.requestPasswordReset({
        email,
        redirectTo: '/reset-password',
      });
      if (error) throw new Error(error.message);
      await authClient.signOut();
    },
    onError: (err) => {
      toast.error(err.message || 'Failed to send password setup email.');
    },
  });

  return (
    <AlertDialog
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (!nextOpen) {
          mutation.reset();
        }
      }}
    >
      <AlertDialogTrigger
        render={
          <Button variant="outline" className="w-fit">
            Set Password
          </Button>
        }
      />
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Set Password</AlertDialogTitle>
          <AlertDialogDescription>
            We'll send a password reset link to your email and sign you out.
            Check your inbox to set your new password.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={mutation.isPending}>
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            disabled={mutation.isPending}
            onClick={(e) => {
              e.preventDefault();
              mutation.mutate();
            }}
          >
            {mutation.isPending && (
              <IconLoader2 className="size-4 animate-spin" />
            )}
            Log Out
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
```

- [ ] **Step 2: Verify no TypeScript errors in the new file**

Run: `pnpm run typecheck`
Expected: PASS — no errors related to `set-password-dialog.tsx`

### Task 2: Update account page to use SetPasswordDialog

**Files:**

- Modify: `apps/web/src/routes/_protected/_account/account.tsx` (lines 16, 89)
- Delete: `apps/web/src/components/account/set-password-button.tsx`

- [ ] **Step 1: Update import in `account.tsx`**

Replace:

```tsx
import { SetPasswordButton } from '@/components/account/set-password-button';
```

With:

```tsx
import { SetPasswordDialog } from '@/components/account/set-password-dialog';
```

- [ ] **Step 2: Update JSX in `account.tsx`**

Replace:

```tsx
{hasPassword === false && <SetPasswordButton email={user.email} />}
```

With:

```tsx
{hasPassword === false && <SetPasswordDialog email={user.email} />}
```

- [ ] **Step 3: Delete old `set-password-button.tsx`**

Run: `rm apps/web/src/components/account/set-password-button.tsx`

- [ ] **Step 4: Verify no TypeScript errors**

Run: `pnpm run typecheck`
Expected: PASS

- [ ] **Step 5: Verify no lint errors**

Run: `pnpm run lint`
Expected: PASS

### Task 3: Rewrite tests for SetPasswordDialog

**Files:**

- Delete: `apps/web/test/unit/components/account/set-password-button.test.tsx`
- Create: `apps/web/test/unit/components/account/set-password-dialog.test.tsx`

- [ ] **Step 1: Delete old test file**

Run: `rm apps/web/test/unit/components/account/set-password-button.test.tsx`

- [ ] **Step 2: Create `set-password-dialog.test.tsx`**

The new tests cover: rendering the trigger button, opening the dialog, canceling, and confirming the log-out action. No success toast is expected (intentionally removed — the dialog message is sufficient since the user reads it before clicking Log Out).

```tsx
// @vitest-environment jsdom
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@workspace/test-utils';
import { SetPasswordDialog } from '@/components/account/set-password-dialog';

const { requestPasswordResetMock, signOutMock } = vi.hoisted(() => ({
  requestPasswordResetMock: vi.fn(),
  signOutMock: vi.fn(),
}));

vi.mock('@workspace/auth/client', () => ({
  authClient: {
    requestPasswordReset: requestPasswordResetMock,
    signOut: signOutMock,
  },
}));

const TEST_EMAIL = 'user@example.com';

describe('SetPasswordDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders set password trigger button', () => {
    renderWithProviders(<SetPasswordDialog email={TEST_EMAIL} />);

    expect(
      screen.getByRole('button', { name: /set password/i })
    ).toBeInTheDocument();
  });

  it('opens confirmation dialog on trigger click', async () => {
    const user = userEvent.setup();
    renderWithProviders(<SetPasswordDialog email={TEST_EMAIL} />);

    await user.click(screen.getByRole('button', { name: /set password/i }));

    expect(screen.getByText(/set password/i, { selector: 'h2' })).toBeInTheDocument();
    expect(screen.getByText(/password reset link/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /log out/i })).toBeInTheDocument();
  });

  it('closes dialog on cancel without calling auth methods', async () => {
    const user = userEvent.setup();
    renderWithProviders(<SetPasswordDialog email={TEST_EMAIL} />);

    await user.click(screen.getByRole('button', { name: /set password/i }));
    await user.click(screen.getByRole('button', { name: /cancel/i }));

    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /log out/i })).not.toBeInTheDocument();
    });
    expect(requestPasswordResetMock).not.toHaveBeenCalled();
    expect(signOutMock).not.toHaveBeenCalled();
  });

  it('calls requestPasswordReset and signOut on log out click', async () => {
    requestPasswordResetMock.mockResolvedValue({ error: null });
    signOutMock.mockResolvedValue(undefined);

    const user = userEvent.setup();
    renderWithProviders(<SetPasswordDialog email={TEST_EMAIL} />);

    await user.click(screen.getByRole('button', { name: /set password/i }));
    await user.click(screen.getByRole('button', { name: /log out/i }));

    await waitFor(() => {
      expect(requestPasswordResetMock).toHaveBeenCalledWith({
        email: TEST_EMAIL,
        redirectTo: '/reset-password',
      });
    });

    await waitFor(() => {
      expect(signOutMock).toHaveBeenCalled();
    });
  });
});
```

- [ ] **Step 3: Run tests to verify they pass**

Run: `pnpm --filter @workspace/web test test/unit/components/account/set-password-dialog.test.tsx`
Expected: PASS — all 4 tests pass

### Task 4: Commit

- [ ] **Step 1: Stage and commit all changes**

```bash
git add apps/web/src/components/account/set-password-dialog.tsx \
       apps/web/src/routes/_protected/_account/account.tsx \
       apps/web/test/unit/components/account/set-password-dialog.test.tsx
git rm apps/web/src/components/account/set-password-button.tsx \
      apps/web/test/unit/components/account/set-password-button.test.tsx
git commit -m "$(cat <<'EOF'
feat(account): add confirmation dialog before set password sign-out

Replace SetPasswordButton with SetPasswordDialog that confirms the
sign-out action before sending a password reset email. Follows the
same AlertDialog pattern as ChangePasswordDialog.
EOF
)"
```
