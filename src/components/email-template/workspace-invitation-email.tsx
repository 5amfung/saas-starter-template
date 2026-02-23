/**
 * Server-only: used when rendering emails; do not import from client code.
 */
import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Link,
  Preview,
  Section,
  Tailwind,
  Text,
  pixelBasedPreset,
} from '@react-email/components';

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
    <Html lang="en" dir="ltr">
      <Head />
      <Preview>{`You're invited to join ${workspaceName}`}</Preview>
      <Tailwind config={{ presets: [pixelBasedPreset] }}>
        <Body className="bg-zinc-100 p-8 px-4 font-sans">
          <Container className="mx-auto max-w-[480px] overflow-hidden rounded-[10px] bg-white shadow-sm">
            <Section className="px-6 py-8">
              <Heading
                as="h1"
                className="mb-4 text-xl font-semibold text-zinc-900"
              >
                Workspace invitation
              </Heading>
              <Text className="mb-6 text-[15px] leading-6 text-zinc-700">
                {inviterEmail} invited you to join{' '}
                <strong>{workspaceName}</strong>.
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
                className="mb-6 block break-all text-sm text-blue-500"
              >
                {invitationUrl}
              </Link>
              <Text className="text-sm leading-5 text-zinc-500">
                You must use this invitation link to join the workspace.
              </Text>
            </Section>
            <Section className="border-t border-zinc-200 p-6">
              <Text className="text-xs text-zinc-400">{appName}</Text>
            </Section>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
}

export default WorkspaceInvitationEmail;
WorkspaceInvitationEmail.PreviewProps = {
  appName: 'My App',
  workspaceName: 'Acme Workspace',
  inviterEmail: 'owner@example.com',
  invitationUrl: 'https://example.com/accept-invite?token=abc123',
} satisfies WorkspaceInvitationEmailProps;
