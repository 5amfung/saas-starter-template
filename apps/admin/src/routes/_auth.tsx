import { useEffect } from 'react';
import { Outlet, createFileRoute, useNavigate } from '@tanstack/react-router';
import { authClient } from '@workspace/auth/client';
import { AuthLayout } from '@workspace/components/auth';
import { guestMiddleware } from '@/middleware/auth';

export const Route = createFileRoute('/_auth')({
  component: AuthPage,
  server: {
    middleware: [guestMiddleware],
  },
});

function AuthPage() {
  const navigate = useNavigate();
  const { data: session, isPending } = authClient.useSession();

  const isAuthenticated =
    session && session.user.emailVerified && session.user.role === 'admin';

  useEffect(() => {
    if (!isPending && isAuthenticated) {
      navigate({ to: '/dashboard' });
    }
  }, [isAuthenticated, isPending, navigate]);

  if (isPending || isAuthenticated) {
    // Returning null here is needed to prevent showing a brief flash of
    // the auth form for an already logged-in user before the redirect
    // completes.
    return null;
  }

  return (
    <AuthLayout>
      <Outlet />
    </AuthLayout>
  );
}
