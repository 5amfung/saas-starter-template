/**
 * Server-only: used when rendering emails; do not import from client code.
 */
import { Button, Heading, Link, Section, Text } from '@react-email/components';
import { EmailShell } from './email-shell';
import type { EmailRequestContext } from '../request-context';

export interface EmailVerificationEmailProps {
  appName: string;
  verificationUrl: string;
  requestContext: EmailRequestContext;
}

export function EmailVerificationEmail({
  appName,
  verificationUrl,
  requestContext,
}: EmailVerificationEmailProps) {
  return (
    <EmailShell
      preview="Verify your email address"
      appName={appName}
      requestContext={requestContext}
    >
      <Heading as="h1" className="mb-4 text-xl font-semibold text-zinc-900">
        Verify your email address
      </Heading>
      <Text className="mb-6 text-[15px] leading-6 text-zinc-700">
        Click the button below to verify your email address and complete setup.
      </Text>
      <Section className="mb-6">
        <Button
          href={verificationUrl}
          className="inline-block rounded-lg bg-zinc-900 px-6 py-3 text-sm font-medium text-white no-underline"
        >
          Verify email
        </Button>
      </Section>
      <Text className="mb-2 text-sm leading-5 text-zinc-500">
        Or copy and paste this link into your browser:
      </Text>
      <Link
        href={verificationUrl}
        className="mb-6 block text-sm break-all text-blue-500"
      >
        {verificationUrl}
      </Link>
      <Text className="mb-6 text-sm leading-5 text-zinc-500">
        After you click the link, you can sign in with this email address.
      </Text>
      <Text className="text-sm leading-5 text-zinc-500">
        This link expires in 10 minutes.
      </Text>
    </EmailShell>
  );
}

export default EmailVerificationEmail;
EmailVerificationEmail.PreviewProps = {
  appName: 'My App',
  verificationUrl: 'https://example.com/api/auth/verify-email?token=abc123',
  requestContext: {
    requestedAtUtc: '13 February 2026, 21:11 UTC',
    ip: '136.24.244.114',
    city: 'San Francisco',
    country: 'US',
  },
} satisfies EmailVerificationEmailProps;
