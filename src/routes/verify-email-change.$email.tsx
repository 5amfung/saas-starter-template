import { useEffect } from 'react';
import { Link, createFileRoute, useNavigate } from '@tanstack/react-router';
import { authClient } from '@/auth/auth-client';
import { AuthLayout } from '@/components/auth/auth-layout';
import { CheckEmailCard } from '@/components/auth/check-email-card';

const SUCCESS_REDIRECT_DELAY_MS = 2000;

function fromBase64Url(base64Url: string) {
  const padded = base64Url.replace(/-/g, '+').replace(/_/g, '/');
  const base64 = padded + '='.repeat((4 - (padded.length % 4)) % 4);

  if (typeof window === 'undefined') {
    return Buffer.from(base64, 'base64').toString('utf8');
  }

  return decodeURIComponent(escape(window.atob(base64)));
}

export const Route = createFileRoute('/verify-email-change/$email')({
  component: VerifyEmailChangePage,
});

function VerifyEmailChangePage() {
  const navigate = useNavigate();
  const { email: emailToken } = Route.useParams();
  const { data: session, isPending } = authClient.useSession();

  let email: string | null = null;
  try {
    email = fromBase64Url(emailToken).trim();
  } catch {
    email = null;
  }

  if (!email) {
    return (
      <AuthLayout>
        <CheckEmailCard
          title="Check your email"
          description="We sent a verification link to your new email address. Click the link to complete the change."
          footer={
            <Link to="/account" className="underline-offset-4 hover:underline">
              Go to account settings
            </Link>
          }
        />
      </AuthLayout>
    );
  }

  const isEmailUpdated =
    session?.user.emailVerified &&
    session.user.email.toLowerCase() === email.toLowerCase();

  if (isPending) return null;

  useEffect(() => {
    if (!isEmailUpdated) return;
    const timer = window.setTimeout(() => {
      navigate({ to: '/account' });
    }, SUCCESS_REDIRECT_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [isEmailUpdated, navigate]);

  if (isEmailUpdated) {
    return (
      <AuthLayout>
        <CheckEmailCard
          title="Email updated"
          description={
            <>
              Your email has been successfully updated to{' '}
              <strong>{session.user.email}</strong>.
            </>
          }
          footer={
            <Link to="/account" className="underline-offset-4 hover:underline">
              Go to account settings (redirecting…)
            </Link>
          }
        />
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <CheckEmailCard
        title="Check your email"
        description={
          <>
            We sent a verification link to <strong>{email}</strong>. Click the
            link in the email to complete the change.
          </>
        }
        footer={
          <Link to="/account" className="underline-offset-4 hover:underline">
            Go to account settings
          </Link>
        }
      />
    </AuthLayout>
  );
}
