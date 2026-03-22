/**
 * Server-only: used when rendering emails; do not import from client code.
 */
import {
  Body,
  Container,
  Head,
  Html,
  Preview,
  Section,
  Tailwind,
  Text,
  pixelBasedPreset,
} from '@react-email/components';
import { EmailSecurityNotice } from './email-security-notice';
import type { EmailRequestContext } from '../request-context';

interface EmailShellProps {
  preview: string;
  appName: string;
  children: React.ReactNode;
  requestContext?: EmailRequestContext;
}

export function EmailShell({
  preview,
  appName,
  children,
  requestContext,
}: EmailShellProps) {
  return (
    <Html lang="en" dir="ltr">
      <Head />
      <Preview>{preview}</Preview>
      <Tailwind config={{ presets: [pixelBasedPreset] }}>
        <Body className="bg-zinc-100 p-8 px-4 font-sans">
          <Container className="mx-auto max-w-[480px] overflow-hidden rounded-[10px] bg-white shadow-sm">
            <Section className="px-6 py-8">
              {children}
              {requestContext && (
                <EmailSecurityNotice requestContext={requestContext} />
              )}
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
