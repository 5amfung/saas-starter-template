import { useEffect } from 'react';
import { Outlet, createFileRoute, useNavigate } from '@tanstack/react-router';
import type { WebAppEntry } from '@/policy/web-app-entry.shared';
import { AuthLayout, WebAuthLogo } from '@/auth';
import { guestMiddleware } from '@/middleware/auth';
import { getWebAppEntryRedirectTarget } from '@/policy/web-app-entry.shared';
import { useWebAppEntry } from '@/policy/web-app-entry';

export const Route = createFileRoute('/_auth')({
  component: AuthPage,
  server: {
    middleware: [guestMiddleware],
  },
});

export function getAuthEntryRedirectTarget(entry?: WebAppEntry) {
  if (!entry) {
    return null;
  }

  return getWebAppEntryRedirectTarget(entry, 'guest');
}

export function getAuthPageState({
  entry,
  isPending,
  error,
}: {
  entry?: WebAppEntry;
  isPending: boolean;
  error: unknown;
}) {
  if (isPending) {
    return { kind: 'loading' as const };
  }

  if (error || !entry) {
    return { kind: 'blocked' as const };
  }

  const redirectTarget = getAuthEntryRedirectTarget(entry);

  if (redirectTarget) {
    return { kind: 'redirect' as const, redirectTarget };
  }

  return { kind: 'render' as const };
}

function AuthPage() {
  const navigate = useNavigate();
  const { data: entry, error, isPending } = useWebAppEntry();
  const state = getAuthPageState({ entry, isPending, error });

  useEffect(() => {
    if (state.kind === 'redirect') {
      navigate({ to: state.redirectTarget });
    }
  }, [navigate, state]);

  if (state.kind !== 'render') {
    // Returning null here is needed to prevent showing a brief flash of
    // auth UI when entry state is still resolving, redirecting, or failed.
    return null;
  }

  return (
    <AuthLayout logo={<WebAuthLogo />}>
      <Outlet />
    </AuthLayout>
  );
}
