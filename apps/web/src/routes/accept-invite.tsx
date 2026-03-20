import * as React from 'react';
import { IconLoader2 } from '@tabler/icons-react';
import { Link, createFileRoute, useNavigate } from '@tanstack/react-router';
import { z } from 'zod';
import { authClient } from '@workspace/auth/client';
import { Button } from '@workspace/ui/components/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@workspace/ui/components/card';
import { FieldDescription } from '@workspace/ui/components/field';
import { AuthLayout } from '@/components/auth/auth-layout';

export const Route = createFileRoute('/accept-invite')({
  component: AcceptInvitePage,
  validateSearch: z.object({
    id: z.string().min(1).optional(),
  }),
});

type AcceptState =
  | { kind: 'working'; message: string }
  | { kind: 'invalid'; message: string }
  | { kind: 'error'; message: string };

function AcceptInvitePage() {
  const navigate = useNavigate();
  const { id } = Route.useSearch();
  const { data: session, isPending } = authClient.useSession();
  const [state, setState] = React.useState<AcceptState>({
    kind: 'working',
    message: 'Checking invitation...',
  });
  const didRunRef = React.useRef(false);

  React.useEffect(() => {
    if (isPending) return;
    if (didRunRef.current) return;
    didRunRef.current = true;

    const run = async () => {
      if (!id) {
        setState({ kind: 'invalid', message: 'Invitation link is invalid.' });
        return;
      }

      if (!session) {
        await navigate({ to: '/signin' });
        return;
      }

      // Logged in but email not verified should never happen but gate it anyway.
      if (!session.user.emailVerified) {
        await authClient.signOut();
        await navigate({ to: '/signin' });
        return;
      }

      setState({ kind: 'working', message: 'Accepting invitation...' });
      const accepted = await authClient.organization.acceptInvitation({
        invitationId: id,
      });

      if (accepted.error) {
        await authClient.signOut();
        setState({
          kind: 'error',
          message: accepted.error.message ?? 'Failed to accept invitation.',
        });
        return;
      }

      await navigate({ to: '/ws' });
    };

    void run();
  }, [id, isPending, navigate, session]);

  return (
    <AuthLayout>
      <Card>
        <CardHeader className="text-center">
          <CardTitle className="text-xl">Invitation</CardTitle>
          <CardDescription>{state.message}</CardDescription>
        </CardHeader>
        <CardContent>
          {state.kind === 'working' ? (
            <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <IconLoader2 className="size-4 animate-spin" />
              Processing...
            </div>
          ) : null}
          {state.kind !== 'working' ? (
            <div className="flex justify-center">
              <Button
                variant="outline"
                nativeButton={false}
                render={<Link to="/" />}
              >
                Go to homepage
              </Button>
            </div>
          ) : null}
        </CardContent>
      </Card>
      <FieldDescription className="px-6 text-center">
        By clicking continue, you agree to our <a href="#">Terms of Service</a>{' '}
        and <a href="#">Privacy Policy</a>.
      </FieldDescription>
    </AuthLayout>
  );
}
