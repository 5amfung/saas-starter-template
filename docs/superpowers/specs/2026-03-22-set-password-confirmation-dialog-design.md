# Set Password Confirmation Dialog

## Problem

On the `/account` page, clicking "Set Password" immediately sends a password reset email and signs the user out. The user is redirected to the sign-in page before they can read the toast message. There is no confirmation step before an irreversible action (sign-out).

## Solution

Replace the `SetPasswordButton` component with a `SetPasswordDialog` component that shows a confirmation AlertDialog before taking action. This follows the same self-contained AlertDialog pattern used by `ChangePasswordDialog` and `ChangeEmailDialog`.

## User Flow

1. User clicks "Set Password" button.
2. AlertDialog opens with a confirmation message explaining that a password reset email will be sent and the user will be signed out.
3. **Cancel** — dialog closes, no action taken.
4. **Log Out** — sends password reset email via `authClient.requestPasswordReset()`, then signs user out via `authClient.signOut()`.
5. No toast is shown — the dialog message is sufficient.
6. On error: toast with error message, dialog stays open.

## Files Changed

### `apps/web/src/components/account/set-password-button.tsx` → `set-password-dialog.tsx`

Rename file and convert from a simple button to a self-contained AlertDialog component.

**Export**: `SetPasswordDialog` (replaces `SetPasswordButton`).

**Props**: `{ email: string }` (unchanged).

**Structure**:

```
AlertDialog (controlled via open/onOpenChange state)
├── AlertDialogTrigger — "Set Password" button (same variant="outline" styling)
└── AlertDialogContent
    ├── AlertDialogHeader
    │   ├── AlertDialogTitle — "Set Password"
    │   └── AlertDialogDescription — Confirmation message explaining
    │       the email will be sent and user will be signed out
    ├── AlertDialogFooter
    │   ├── AlertDialogCancel — "Cancel" (disabled while pending)
    │   └── AlertDialogAction — "Log Out" button with loading spinner
    │       (disabled while pending, onClick triggers mutation)
```

**Mutation**: Same as current `SetPasswordButton` — calls `authClient.requestPasswordReset({ email, redirectTo: '/reset-password' })` then `authClient.signOut()`. On error, shows toast. No success toast.

**Dialog state**: Controlled with `useState(false)`. On close (`onOpenChange(false)`), reset mutation state.

### `apps/web/src/routes/_protected/_account/account.tsx`

- Update import: `SetPasswordButton` → `SetPasswordDialog` from `set-password-dialog`.
- Update JSX: `<SetPasswordButton email={user.email} />` → `<SetPasswordDialog email={user.email} />`.

## Not Changed

- No new dependencies.
- No schema changes (no form fields in this dialog).
- No server function changes.
- Password card description text in `account.tsx` remains unchanged — it already explains the flow.
