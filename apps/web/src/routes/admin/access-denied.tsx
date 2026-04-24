import { Link, createFileRoute } from '@tanstack/react-router';
import { buttonVariants } from '@workspace/ui/components/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@workspace/ui/components/card';

export const Route = createFileRoute('/admin/access-denied')({
  component: AdminAccessDeniedPage,
});

export function AdminAccessDeniedPage() {
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
          <Link
            to="/signin"
            search={{ redirect: '/admin' }}
            className={buttonVariants({ variant: 'outline' })}
          >
            Switch account
          </Link>
        </CardContent>
      </Card>
    </main>
  );
}
