import * as React from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
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
  AlertDialogTrigger,
} from '@workspace/ui/components/alert-dialog';
import { Button } from '@workspace/ui/components/button';
import { Input } from '@workspace/ui/components/input';
import { authClient } from '@workspace/auth/client';

const CONFIRMATION_TEXT = 'DELETE';

interface AdminDeleteUserDialogProps {
  userId: string;
  userEmail: string;
  disabled?: boolean;
}

export function AdminDeleteUserDialog({
  userId,
  userEmail,
  disabled,
}: AdminDeleteUserDialogProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [open, setOpen] = React.useState(false);
  const [confirmation, setConfirmation] = React.useState('');

  const isConfirmed = confirmation === CONFIRMATION_TEXT;

  const mutation = useMutation({
    mutationFn: async () => {
      const { error } = await authClient.admin.removeUser({ userId });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      toast.success('User deleted successfully.');
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
      navigate({ to: '/admin/user' });
    },
    onError: (err) => {
      toast.error(err.message || 'Failed to delete user.');
    },
  });

  // Reset confirmation when dialog opens/closes.
  React.useEffect(() => {
    if (!open) setConfirmation('');
  }, [open]);

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger
        render={
          <Button variant="destructive" className="w-fit" disabled={disabled}>
            Delete User
          </Button>
        }
      />
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogMedia className="bg-destructive/10">
            <IconAlertTriangle className="text-destructive" />
          </AlertDialogMedia>
          <AlertDialogTitle>Delete User</AlertDialogTitle>
          <AlertDialogDescription>
            This will permanently delete <strong>{userEmail}</strong> and all
            associated data. This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="flex flex-col gap-2">
          <label htmlFor="delete-confirm" className="text-sm font-medium">
            Type <strong>{CONFIRMATION_TEXT}</strong> to confirm
          </label>
          <Input
            id="delete-confirm"
            value={confirmation}
            onChange={(e) => setConfirmation(e.target.value)}
            placeholder={CONFIRMATION_TEXT}
            autoComplete="off"
          />
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={!isConfirmed || mutation.isPending}
            onClick={(e) => {
              e.preventDefault();
              mutation.mutate();
            }}
          >
            {mutation.isPending && (
              <IconLoader2 className="size-4 animate-spin" />
            )}
            Confirm delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
