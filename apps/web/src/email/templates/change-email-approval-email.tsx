/**
 * Server-only: used when rendering emails; do not import from client code.
 */
import { Button, Heading, Link, Section, Text } from '@react-email/components';
import { EmailShell } from './email-shell';
import type { EmailRequestContext } from '../request-context';

export interface ChangeEmailApprovalEmailProps {
  appName: string;
  newEmail: string;
  approvalUrl: string;
  requestContext: EmailRequestContext;
}

export function ChangeEmailApprovalEmail({
  appName,
  newEmail,
  approvalUrl,
  requestContext,
}: ChangeEmailApprovalEmailProps) {
  return (
    <EmailShell
      preview={`Approve your email change to ${newEmail}`}
      appName={appName}
      requestContext={requestContext}
    >
      <Heading as="h1" className="mb-4 text-xl font-semibold text-zinc-900">
        Do NOT click the button if you didn't request email change!
      </Heading>
      <Text className="mb-6 text-[15px] leading-6 text-zinc-700">
        A request was made to change your account email to{' '}
        <strong>{newEmail}</strong>. Click the button below to approve this
        change.
      </Text>
      <Section className="mb-6">
        <Button
          href={approvalUrl}
          className="inline-block rounded-lg bg-zinc-900 px-6 py-3 text-sm font-medium text-white no-underline"
        >
          Approve change
        </Button>
      </Section>
      <Text className="mb-2 text-sm leading-5 text-zinc-500">
        Or copy and paste this link into your browser:
      </Text>
      <Link
        href={approvalUrl}
        className="mb-6 block text-sm break-all text-blue-500"
      >
        {approvalUrl}
      </Link>
      <Text className="mb-6 text-sm leading-5 text-zinc-500">
        After you approve, we will send a verification email to{' '}
        <strong>{newEmail}</strong>. Your account email updates only after you
        click the link in that email.
      </Text>
      <Text className="text-sm leading-5 text-zinc-500">
        This link expires in 10 minutes.
      </Text>
    </EmailShell>
  );
}

export default ChangeEmailApprovalEmail;
ChangeEmailApprovalEmail.PreviewProps = {
  appName: 'My App',
  newEmail: 'new@example.com',
  approvalUrl: 'https://example.com/api/auth/verify-email?token=abc123',
  requestContext: {
    requestedAtUtc: '13 February 2026, 21:11 UTC',
    ip: '136.24.244.114',
    city: 'San Francisco',
    country: 'US',
  },
} satisfies ChangeEmailApprovalEmailProps;
