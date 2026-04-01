import { useState } from 'react';
import { IconLoader } from '@tabler/icons-react';
import { authClient } from '@workspace/auth/client';
import { Button } from '@workspace/ui/components/button';
import { GoogleIcon } from '@workspace/components/icons';

const DEFAULT_CALLBACK_URL = '/ws';

export function GoogleSignInButton({
  callbackURL = DEFAULT_CALLBACK_URL,
}: {
  callbackURL?: string;
}) {
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleClick = async () => {
    setIsPending(true);
    setError(null);
    const { error: signInError } = await authClient.signIn.social({
      provider: 'google',
      callbackURL,
      errorCallbackURL: '/signin',
    });
    if (signInError) {
      setError(signInError.message ?? 'Something went wrong.');
      setIsPending(false);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <Button
        variant="outline"
        type="button"
        disabled={isPending}
        onClick={handleClick}
      >
        {isPending ? (
          <IconLoader className="animate-spin" />
        ) : (
          <GoogleIcon className="size-4" />
        )}
        Sign in with Google
      </Button>
      {error && <p className="text-center text-sm text-destructive">{error}</p>}
    </div>
  );
}
