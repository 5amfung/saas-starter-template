import * as React from 'react';
import { Link, createFileRoute, useNavigate } from '@tanstack/react-router';
import { Button, buttonVariants } from '@workspace/ui/components/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@workspace/ui/components/card';
import { authClient } from '@/auth/client/auth-client';

export const Route = createFileRoute('/admin/access-denied')({
  component: AdminAccessDeniedPage,
});

export function AdminAccessDeniedPage() {
  const navigate = useNavigate();
  const [isSwitchingAccount, setIsSwitchingAccount] = React.useState(false);

  async function handleSwitchAccount() {
    setIsSwitchingAccount(true);

    try {
      await authClient.signOut();
      await navigate({ to: '/signin', search: { redirect: '/admin' } });
    } catch (error) {
      console.error('Switch account failed', error);
      setIsSwitchingAccount(false);
    }
  }

  return (
    <main className="flex min-h-svh items-center justify-center p-6">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle role="heading" aria-level={1}>
            Access denied
          </CardTitle>
          <CardDescription>
            The current account does not have admin access.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex gap-2">
          <Link to="/" className={buttonVariants()}>
            Go to app
          </Link>
          <Button
            type="button"
            variant="outline"
            onClick={handleSwitchAccount}
            disabled={isSwitchingAccount}
          >
            {isSwitchingAccount ? 'Switching...' : 'Switch account'}
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}
