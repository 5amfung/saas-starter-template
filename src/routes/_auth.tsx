import { useEffect } from 'react';
import { IconStack2 } from '@tabler/icons-react';
import { Outlet, createFileRoute, useNavigate } from '@tanstack/react-router';
import { authClient } from '@/lib/auth/auth-client';
import { guestMiddleware } from '@/middleware/auth';

export const Route = createFileRoute('/_auth')({
  component: AuthLayout,
  server: {
    middleware: [guestMiddleware],
  },
});

function AuthLayout() {
  const navigate = useNavigate();
  const { data: session, isPending } = authClient.useSession();

  const isAuthenticated = session && session.user.emailVerified;

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
    <div className="bg-muted flex min-h-svh flex-col items-center justify-center gap-6 p-6 md:p-10">
      <div className="flex w-full max-w-sm flex-col gap-6">
        <a href="/" className="flex items-center gap-2 self-center font-medium">
          <div className="bg-primary text-primary-foreground flex size-6 items-center justify-center rounded-md">
            <IconStack2 className="size-4" />
          </div>
          Acme Inc.
        </a>
        <div className="flex flex-col gap-6">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
