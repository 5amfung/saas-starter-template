import { useState } from 'react';
import { IconLoader } from '@tabler/icons-react';
import { Link, createFileRoute } from '@tanstack/react-router';
import { toast } from 'sonner';
import { Button } from '@workspace/ui/components/button';
import { verifySearchSchema } from '@workspace/auth/schemas';
import { authClient } from '@workspace/auth/client';
import { getWebmailLinkForEmail } from '@workspace/components/lib';
import { CheckEmailCard } from '@workspace/components/auth';

export const Route = createFileRoute('/_auth/verify')({
  component: VerifyPage,
  validateSearch: (search) => verifySearchSchema.parse(search),
});

function VerifyPage() {
  const { email, redirect } = Route.useSearch();
  const [isResending, setIsResending] = useState(false);

  if (!email) {
    return (
      <CheckEmailCard
        title="Email address required"
        description="An email address is required to verify your account. Please sign in or sign up to receive a verification link."
        footer={
          <Link to="/signin" className="underline-offset-4 hover:underline">
            Go to sign in
          </Link>
        }
      />
    );
  }

  const webmail = getWebmailLinkForEmail(email);

  async function handleResend() {
    if (!email) return;
    setIsResending(true);
    try {
      const { error } = await authClient.sendVerificationEmail({
        email,
        callbackURL: redirect ?? '/dashboard',
      });
      if (error) {
        toast.error(error.message ?? 'Failed to resend verification email.');
      } else {
        toast.success('Verification email sent. Check your inbox.');
      }
    } finally {
      setIsResending(false);
    }
  }

  return (
    <CheckEmailCard
      title="Check your email"
      description={
        <>
          We sent a verification link to <strong>{email}</strong>. Click the
          link in that email to verify your account.
        </>
      }
      actions={
        <Button
          variant="outline"
          onClick={handleResend}
          disabled={isResending}
          className="w-full"
        >
          {isResending && <IconLoader className="animate-spin" />}
          Resend verification email
        </Button>
      }
      footer={
        webmail ? (
          <a
            href={webmail.href}
            target="_blank"
            rel="noreferrer noopener"
            className="underline-offset-4 hover:underline"
          >
            Go to {webmail.label}
          </a>
        ) : undefined
      }
    />
  );
}
