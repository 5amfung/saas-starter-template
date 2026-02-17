import * as React from 'react';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
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
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Field, FieldError, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { authClient } from '@/auth/auth-client';
import { changeEmailSchema } from '@/account/schemas';

const CONFIRMATION_TEXT = 'CHANGE';

interface ChangeEmailDialogProps {
  currentEmail: string;
}

export function ChangeEmailDialog({ currentEmail }: ChangeEmailDialogProps) {
  const [open, setOpen] = React.useState(false);
  const [confirmation, setConfirmation] = React.useState('');
  const [newEmail, setNewEmail] = React.useState('');

  function toBase64Url(input: string) {
    const base64 =
      typeof window === 'undefined'
        ? Buffer.from(input, 'utf8').toString('base64')
        : window.btoa(unescape(encodeURIComponent(input)));

    return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
  }

  const isConfirmed = confirmation === CONFIRMATION_TEXT;
  const parsedEmail = changeEmailSchema.safeParse({ newEmail });
  const isEmailValid =
    parsedEmail.success &&
    newEmail.trim().toLowerCase() !== currentEmail.toLowerCase();
  const canSubmit = isConfirmed && isEmailValid;

  const mutation = useMutation({
    mutationFn: async () => {
      const normalizedEmail = newEmail.trim().toLowerCase();
      const emailToken = toBase64Url(normalizedEmail);
      const { error } = await authClient.changeEmail({
        newEmail: normalizedEmail,
        callbackURL: `/verify-email-change/${emailToken}`,
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      toast.success('Check your current email to approve this change.');
      setOpen(false);
    },
    onError: (err) => {
      toast.error(err.message || 'Failed to initiate email change.');
    },
  });

  React.useEffect(() => {
    if (!open) {
      setConfirmation('');
      setNewEmail('');
    }
  }, [open]);

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger
        render={
          <Button variant="outline" className="w-fit">
            Change Email
          </Button>
        }
      />
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Change Email</AlertDialogTitle>
          <AlertDialogDescription>
            Changing your email is a two-step process:
          </AlertDialogDescription>
          <div className="text-muted-foreground space-y-1 pl-0 text-sm text-balance">
            <ol className="list-decimal space-y-1 pl-4">
              <li>
                We email your <strong>current</strong> address to approve the
                change.
              </li>
              <li>
                After you approve, we email the <strong>new</strong> address
                with a verification link.
              </li>
              <li>
                Your account email is updated only after you click that link.
              </li>
            </ol>
          </div>
        </AlertDialogHeader>

        <div className="flex flex-col gap-4">
          <Field>
            <FieldLabel htmlFor="new-email">New email address</FieldLabel>
            <Input
              id="new-email"
              type="email"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              placeholder="new@example.com"
              autoComplete="email"
            />
            {!parsedEmail.success && newEmail.trim() && (
              <FieldError
                errors={parsedEmail.error.issues.map((e) => ({
                  message: e.message,
                }))}
              />
            )}
            {parsedEmail.success &&
              newEmail.trim().toLowerCase() === currentEmail.toLowerCase() && (
                <FieldError
                  errors={[{ message: 'New email must differ from current.' }]}
                />
              )}
          </Field>

          <div className="flex flex-col gap-2">
            <label htmlFor="change-confirm" className="text-sm font-medium">
              Type <strong>{CONFIRMATION_TEXT}</strong> to confirm
            </label>
            <Input
              id="change-confirm"
              value={confirmation}
              onChange={(e) => setConfirmation(e.target.value)}
              placeholder={CONFIRMATION_TEXT}
              autoComplete="off"
            />
          </div>
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            disabled={!canSubmit || mutation.isPending}
            onClick={(e) => {
              e.preventDefault();
              if (canSubmit) mutation.mutate();
            }}
          >
            {mutation.isPending && (
              <IconLoader2 className="size-4 animate-spin" />
            )}
            Change Email
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
