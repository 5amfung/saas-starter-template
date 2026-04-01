import * as React from 'react';
import {
  IconDeviceDesktop,
  IconDeviceMobile,
  IconLoader2,
  IconTrash,
} from '@tabler/icons-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
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
} from '@workspace/ui/components/alert-dialog';
import { Badge } from '@workspace/ui/components/badge';
import { Button } from '@workspace/ui/components/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@workspace/ui/components/card';
import { Skeleton } from '@workspace/ui/components/skeleton';
import {
  SESSIONS_QUERY_KEY,
  useSessionQuery,
  useSessionsQuery,
} from '@workspace/components/hooks';

interface SessionItem {
  id: string;
  token: string;
  updatedAt: unknown;
  ipAddress?: string | null;
  userAgent?: string | null;
}

function toTimestamp(value: unknown): number {
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'string' || typeof value === 'number') {
    const timestamp = new Date(value).getTime();
    return Number.isNaN(timestamp) ? 0 : timestamp;
  }
  return 0;
}

function formatLastActive(value: unknown) {
  const timestamp = toTimestamp(value);
  if (!timestamp) return 'Unknown';
  return new Date(timestamp).toLocaleString();
}

function isMobileDevice(userAgent?: string | null) {
  if (!userAgent) return false;
  return /mobile|iphone|ipad|android|tablet/i.test(userAgent);
}

function getDeviceName(userAgent?: string | null) {
  if (!userAgent) return 'Unknown device';
  if (/iphone/i.test(userAgent)) return 'iPhone';
  if (/ipad/i.test(userAgent)) return 'iPad';
  if (/android/i.test(userAgent)) return 'Android device';
  if (/macintosh|mac os/i.test(userAgent)) return 'Mac';
  if (/windows/i.test(userAgent)) return 'Windows PC';
  if (/linux/i.test(userAgent)) return 'Linux device';
  return 'Browser session';
}

function getBrowserFamily(userAgent?: string | null) {
  if (!userAgent) return 'Unknown browser';
  if (/edg\//i.test(userAgent)) return 'Edge';
  if (/firefox\//i.test(userAgent)) return 'Firefox';
  if (/opr\/|opera/i.test(userAgent)) return 'Opera';
  if (/chrome\//i.test(userAgent) && !/edg\//i.test(userAgent)) return 'Chrome';
  if (/safari\//i.test(userAgent) && !/chrome\//i.test(userAgent))
    return 'Safari';
  return 'Unknown browser';
}

function formatLoginMethod(method: string | null | undefined) {
  if (!method) return 'unknown';
  return method.charAt(0).toUpperCase() + method.slice(1);
}

export function ActiveSessionsList() {
  const queryClient = useQueryClient();
  const { data: currentSessionData } = useSessionQuery();
  const { data: sessions, isPending, error, refetch } = useSessionsQuery();
  const [selectedSession, setSelectedSession] =
    React.useState<SessionItem | null>(null);

  const revokeSessionMutation = useMutation({
    mutationFn: async (token: string) => {
      const { error: revokeError } = await authClient.revokeSession({ token });
      if (revokeError) throw new Error(revokeError.message);
    },
    onSuccess: async () => {
      toast.success('Session revoked.');
      setSelectedSession(null);
      await queryClient.invalidateQueries({ queryKey: SESSIONS_QUERY_KEY });
    },
    onError: (mutationError) => {
      toast.error(mutationError.message || 'Failed to revoke session.');
    },
  });

  const currentSessionToken = currentSessionData?.session.token ?? null;
  const { data: lastLoginMethod = null } = useQuery({
    queryKey: ['account', 'last-login-method'],
    queryFn: () => authClient.getLastUsedLoginMethod(),
    staleTime: Infinity,
  });
  const lastSignInAt = currentSessionData?.user.lastSignInAt ?? null;

  const sortedSessions = React.useMemo(() => {
    // Better Auth's listSessions return type uses opaque Date wrappers for updatedAt.
    // SessionItem uses `unknown` for updatedAt to handle both Date and string values safely.
    const safeSessions = (sessions ?? []) as Array<SessionItem>;
    return [...safeSessions].sort(
      (firstSession, secondSession) =>
        toTimestamp(secondSession.updatedAt) -
        toTimestamp(firstSession.updatedAt)
    );
  }, [sessions]);

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Active sessions</CardTitle>
          {lastLoginMethod || lastSignInAt ? (
            <p className="text-sm text-muted-foreground">
              Last signed in
              {lastLoginMethod
                ? ` with ${formatLoginMethod(lastLoginMethod)}`
                : ''}
              {lastSignInAt ? ` on ${formatLastActive(lastSignInAt)}` : ''}.
            </p>
          ) : null}
          <CardDescription>
            Devices currently signed in to your account.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {isPending && (
            <div className="space-y-3">
              <Skeleton className="h-14 w-full" />
              <Skeleton className="h-14 w-full" />
              <Skeleton className="h-14 w-full" />
            </div>
          )}

          {error && (
            <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3">
              <p className="text-sm font-medium text-destructive">
                Failed to load active sessions.
              </p>
              <Button
                type="button"
                variant="link"
                className="mt-1 h-auto px-0 text-destructive"
                onClick={() => {
                  void refetch();
                }}
              >
                Retry
              </Button>
            </div>
          )}

          {!isPending && !error && sortedSessions.length === 0 && (
            <p className="text-sm text-muted-foreground">
              No active sessions found.
            </p>
          )}

          {!isPending &&
            !error &&
            sortedSessions.map((session) => {
              const isCurrentSession = session.token === currentSessionToken;
              const DeviceIcon = isMobileDevice(session.userAgent)
                ? IconDeviceMobile
                : IconDeviceDesktop;

              return (
                <div
                  key={session.id}
                  className="flex flex-col gap-3 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex items-start gap-3">
                    <div className="rounded-md border bg-muted p-2">
                      <DeviceIcon className="size-4 text-muted-foreground" />
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium">
                          {getDeviceName(session.userAgent)} ·{' '}
                          {getBrowserFamily(session.userAgent)}
                        </p>
                        {isCurrentSession && (
                          <Badge variant="secondary">This device</Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Last active: {formatLastActive(session.updatedAt)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        IP: {session.ipAddress || 'Unknown'}
                      </p>
                    </div>
                  </div>

                  {!isCurrentSession && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive sm:self-center"
                      onClick={() => setSelectedSession(session)}
                    >
                      <IconTrash />
                      Revoke
                    </Button>
                  )}
                </div>
              );
            })}
        </CardContent>
      </Card>

      <AlertDialog
        open={selectedSession !== null}
        onOpenChange={(open) => {
          if (!open) setSelectedSession(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revoke session?</AlertDialogTitle>
            <AlertDialogDescription>
              This will sign that device out of your account.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={revokeSessionMutation.isPending}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={!selectedSession || revokeSessionMutation.isPending}
              onClick={(event) => {
                event.preventDefault();
                if (!selectedSession) return;
                revokeSessionMutation.mutate(selectedSession.token);
              }}
            >
              {revokeSessionMutation.isPending && (
                <IconLoader2 className="size-4 animate-spin" />
              )}
              Revoke session
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
