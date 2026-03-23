/**
 *  Server-only: used when rendering emails; do not import from client code.
 */
import { Button, Heading, Link, Section, Text } from '@react-email/components';
import { EmailShell } from './email-shell';
import type { EmailRequestContext } from '../request-context';

export interface ResetPasswordEmailProps {
  appName: string;
  resetUrl: string;
  requestContext: EmailRequestContext;
}

export function ResetPasswordEmail({
  appName,
  resetUrl,
  requestContext,
}: ResetPasswordEmailProps) {
  return (
    <EmailShell
      preview="Reset your password"
      appName={appName}
      requestContext={requestContext}
    >
      <Heading as="h1" className="mb-4 text-xl font-semibold text-zinc-900">
        Reset your password
      </Heading>
      <Text className="mb-6 text-[15px] leading-6 text-zinc-700">
        If an account exists for your email, click the button below to reset
        your password.
      </Text>
      <Section className="mb-6">
        <Button
          href={resetUrl}
          className="inline-block rounded-lg bg-zinc-900 px-6 py-3 text-sm font-medium text-white no-underline"
        >
          Reset password
        </Button>
      </Section>
      <Text className="mb-2 text-sm leading-5 text-zinc-500">
        Or copy and paste this link into your browser:
      </Text>
      <Link
        href={resetUrl}
        className="mb-6 block text-sm break-all text-blue-500"
      >
        {resetUrl}
      </Link>
      <Text className="text-sm leading-5 text-zinc-500">
        This link expires in 10 minutes.
      </Text>
    </EmailShell>
  );
}

export default ResetPasswordEmail;
ResetPasswordEmail.PreviewProps = {
  appName: 'My App',
  resetUrl: 'https://example.com/reset-password?token=abc123',
  requestContext: {
    requestedAtUtc: '13 February 2026, 21:11 UTC',
    ip: '136.24.244.114',
    city: 'San Francisco',
    country: 'US',
  },
} satisfies ResetPasswordEmailProps;
