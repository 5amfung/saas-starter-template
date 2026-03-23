/**
 * Server-only: used when rendering emails; do not import from client code.
 */
import { Button, Heading, Link, Section, Text } from '@react-email/components';
import { EmailShell } from './email-shell';

export interface WorkspaceInvitationEmailProps {
  appName: string;
  workspaceName: string;
  inviterEmail: string;
  invitationUrl: string;
}

export function WorkspaceInvitationEmail({
  appName,
  workspaceName,
  inviterEmail,
  invitationUrl,
}: WorkspaceInvitationEmailProps) {
  return (
    <EmailShell
      preview={`You're invited to join ${workspaceName}`}
      appName={appName}
    >
      <Heading as="h1" className="mb-4 text-xl font-semibold text-zinc-900">
        Workspace invitation
      </Heading>
      <Text className="mb-6 text-[15px] leading-6 text-zinc-700">
        {inviterEmail} invited you to join <strong>{workspaceName}</strong>.
      </Text>
      <Section className="mb-6">
        <Button
          href={invitationUrl}
          className="inline-block rounded-lg bg-zinc-900 px-6 py-3 text-sm font-medium text-white no-underline"
        >
          Accept invitation
        </Button>
      </Section>
      <Text className="mb-2 text-sm leading-5 text-zinc-500">
        If the button does not work, copy this link into your browser:
      </Text>
      <Link
        href={invitationUrl}
        className="mb-6 block text-sm break-all text-blue-500"
      >
        {invitationUrl}
      </Link>
      <Text className="text-sm leading-5 text-zinc-500">
        You must use this invitation link to join the workspace.
      </Text>
    </EmailShell>
  );
}

export default WorkspaceInvitationEmail;
WorkspaceInvitationEmail.PreviewProps = {
  appName: 'My App',
  workspaceName: 'Acme Workspace',
  inviterEmail: 'owner@example.com',
  invitationUrl: 'https://example.com/accept-invite?token=abc123',
} satisfies WorkspaceInvitationEmailProps;
