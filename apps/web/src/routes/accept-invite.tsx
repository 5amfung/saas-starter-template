import * as React from 'react';
import { IconLoader2, IconStack2 } from '@tabler/icons-react';
import { Link, createFileRoute, useNavigate } from '@tanstack/react-router';
import { z } from 'zod';
import {
  OPERATIONS,
  buildWorkflowAttributes,
  startWorkflowSpan,
  workflowLogger,
} from '@workspace/logging/client';
import { Button } from '@workspace/ui/components/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@workspace/ui/components/card';
import { FieldDescription } from '@workspace/ui/components/field';
import type { WebAppEntry } from '@/policy/web-app-entry.shared';
import { authClient } from '@/auth/client/auth-client';
import { AuthLayout } from '@/auth';
import { useWebAppEntry } from '@/policy/web-app-entry';

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

export type InviteEntryOutcome =
  | { kind: 'redirectToSignup'; reason: 'missingSession' | 'unverifiedSession' }
  | { kind: 'acceptInvite' };

function assertNever(value: never): never {
  throw new Error(`Unexpected invite entry variant: ${JSON.stringify(value)}`);
}

export function resolveInviteEntryOutcome(
  entry: WebAppEntry
): InviteEntryOutcome {
  switch (entry.kind) {
    case 'redirect':
      switch (entry.to) {
        case '/signin':
          return {
            kind: 'redirectToSignup',
            reason: 'missingSession',
          };
        case '/verify':
          return {
            kind: 'redirectToSignup',
            reason: 'unverifiedSession',
          };
        default:
          return assertNever(entry.to);
      }
    case 'blocked':
    case 'mustResolveWorkspace':
    case 'canEnterWebApp':
      return { kind: 'acceptInvite' };
    default:
      return assertNever(entry);
  }
}

function AcceptInvitePage() {
  const navigate = useNavigate();
  const { id } = Route.useSearch();
  const { data: entry, isPending } = useWebAppEntry();
  const workflowAttributes = buildWorkflowAttributes(
    OPERATIONS.AUTH_INVITE_ACCEPT,
    {
      route: '/accept-invite',
      result: 'attempt',
    }
  );
  const [state, setState] = React.useState<AcceptState>({
    kind: 'working',
    message: 'Checking invitation...',
  });
  const didRunRef = React.useRef<string | null>(null);

  React.useEffect(() => {
    if (isPending) return;

    const run = async () => {
      if (!id) {
        setState({ kind: 'invalid', message: 'Invitation link is invalid.' });
        return;
      }

      if (!entry) {
        setState({
          kind: 'error',
          message: 'Unable to check invitation eligibility.',
        });
        return;
      }

      if (didRunRef.current === id) return;
      didRunRef.current = id;

      const returnTo = `/accept-invite?id=${encodeURIComponent(id)}`;
      await startWorkflowSpan(
        {
          op: OPERATIONS.AUTH_INVITE_ACCEPT,
          name: 'Accept invitation',
          attributes: workflowAttributes,
        },
        async () => {
          const outcome = resolveInviteEntryOutcome(entry);

          if (outcome.kind === 'redirectToSignup') {
            workflowLogger.info('Auth invite redirected to sign up', {
              ...workflowAttributes,
              failureCategory: outcome.reason,
            });
            if (outcome.reason === 'unverifiedSession') {
              await authClient.signOut();
            }
            await navigate({ to: '/signup', search: { redirect: returnTo } });
            return;
          }

          setState({ kind: 'working', message: 'Accepting invitation...' });
          const accepted = await authClient.organization.acceptInvitation({
            invitationId: id,
          });

          if (accepted.error) {
            workflowLogger.error('Auth invite acceptance failed', {
              ...workflowAttributes,
              result: 'failure',
              failureCategory: 'accept_invitation_failed',
            });
            await authClient.signOut();
            setState({
              kind: 'error',
              message: accepted.error.message ?? 'Failed to accept invitation.',
            });
            return;
          }

          workflowLogger.info('Auth invite accepted', {
            ...workflowAttributes,
            result: 'success',
          });
          await navigate({ to: '/ws' });
        }
      );
    };

    void run();
  }, [entry, id, isPending, navigate]);

  const webLogo = (
    <a href="/" className="flex items-center gap-2 self-center font-medium">
      <div className="flex size-6 items-center justify-center rounded-md bg-primary text-primary-foreground">
        <IconStack2 className="size-4" />
      </div>
      Acme Inc.
    </a>
  );

  return (
    <AuthLayout logo={webLogo}>
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
