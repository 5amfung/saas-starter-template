import { useEffect } from 'react';
import { Outlet, createFileRoute, useNavigate } from '@tanstack/react-router';
import { authMiddleware } from '@/middleware/auth';
import { authClient } from '@/lib/auth/auth-client';

export const Route = createFileRoute('/_protected')({
  component: ProtectedLayout,
  server: {
    middleware: [authMiddleware],
  },
});

function ProtectedLayout() {
  const navigate = useNavigate();
  const { data: session, isPending } = authClient.useSession();

  const isAuthenticated = session && session.user.emailVerified;

  useEffect(() => {
    if (!isPending && !isAuthenticated) {
      navigate({ to: '/login' });
    }
  }, [isAuthenticated, isPending, navigate]);

  if (isPending || !isAuthenticated) {
    return null;
  }

  return <Outlet />;
}
