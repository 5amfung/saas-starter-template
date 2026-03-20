import { useMutation } from '@tanstack/react-query';
import { IconLoader2 } from '@tabler/icons-react';
import { toast } from 'sonner';
import { Button } from '@workspace/ui/components/button';
import { authClient } from '@workspace/auth/client';

export function SetPasswordButton({ email }: { email: string }) {
  const mutation = useMutation({
    mutationFn: async () => {
      const { error } = await authClient.requestPasswordReset({
        email,
        redirectTo: '/reset-password',
      });
      if (error) throw new Error(error.message);
      await authClient.signOut();
    },
    onSuccess: () => {
      toast.success('Check your email for a link to set your password.');
    },
    onError: (err) => {
      toast.error(err.message || 'Failed to send password setup email.');
    },
  });

  return (
    <Button
      variant="outline"
      className="w-fit"
      disabled={mutation.isPending || mutation.isSuccess}
      onClick={() => mutation.mutate()}
    >
      {mutation.isPending && <IconLoader2 className="size-4 animate-spin" />}
      Set Password
    </Button>
  );
}
