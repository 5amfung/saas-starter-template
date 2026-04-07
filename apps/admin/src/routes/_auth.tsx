import { useEffect } from 'react';
import { Outlet, createFileRoute, useNavigate } from '@tanstack/react-router';
import { AuthLayout } from '@workspace/components/auth';
import type { AdminAppEntry } from '@/policy/admin-app-capabilities.shared';
import { guestMiddleware } from '@/middleware/auth';
import { getAdminAppEntryRedirect } from '@/policy/admin-app-capabilities.shared';
import { useAdminAppEntry } from '@/policy/admin-app-capabilities';

export const Route = createFileRoute('/_auth')({
  component: AuthPage,
  server: {
    middleware: [guestMiddleware],
  },
});

export function getAuthEntryRedirectTarget(entry?: AdminAppEntry) {
  if (!entry) {
    return null;
  }

  return getAdminAppEntryRedirect(entry, 'guest');
}

export function getAuthPageState({
  entry,
  isPending,
  error,
}: {
  entry?: AdminAppEntry;
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
  const { data: entry, error, isPending } = useAdminAppEntry();
  const state = getAuthPageState({ entry, isPending, error });

  useEffect(() => {
    if (state.kind === 'redirect') {
      navigate(state.redirectTarget);
    }
  }, [navigate, state]);

  if (state.kind !== 'render') {
    // Returning null here is needed to prevent showing a brief flash of
    // the auth form for an already logged-in user before the redirect
    // completes or entry state is still resolving / failed.
    return null;
  }

  return (
    <AuthLayout>
      <Outlet />
    </AuthLayout>
  );
}
