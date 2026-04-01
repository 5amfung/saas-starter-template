import { useEffect } from 'react';
import { Outlet, createFileRoute, useNavigate } from '@tanstack/react-router';
import { IconStack2 } from '@tabler/icons-react';
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

  const isAuthenticated = session && session.user.emailVerified;

  useEffect(() => {
    if (!isPending && isAuthenticated) {
      navigate({ to: '/ws' });
    }
  }, [isAuthenticated, isPending, navigate]);

  if (isPending || isAuthenticated) {
    // Returning null here is needed to prevent showing a brief flash of
    // the auth form for an already logged-in user before the redirect
    // completes.
    return null;
  }

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
      <Outlet />
    </AuthLayout>
  );
}
