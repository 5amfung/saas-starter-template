import * as React from 'react';
import { IconLoader2 } from '@tabler/icons-react';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
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
import { authClient } from '@/auth/admin-auth-client';

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
            Log Out Now
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
