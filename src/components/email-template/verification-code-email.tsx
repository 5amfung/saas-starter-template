/**
 * Server-only: used when rendering emails; do not import from client code.
 */
import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Section,
  Tailwind,
  Text,
  pixelBasedPreset,
} from '@react-email/components';
import type { EmailRequestContext } from '@/email/email-request-context.server';
import { EmailSecurityNotice } from './email-security-notice';

export interface VerificationCodeEmailProps {
  appName: string;
  otp: string;
  requestContext: EmailRequestContext;
  type?: string;
}

export function VerificationCodeEmail({
  appName,
  otp,
  requestContext,
}: VerificationCodeEmailProps) {
  return (
    <Html lang="en" dir="ltr">
      <Head />
      <Preview>Your verification code is {otp}</Preview>
      <Tailwind config={{ presets: [pixelBasedPreset] }}>
        <Body className="bg-zinc-100 p-8 px-4 font-sans">
          <Container className="mx-auto max-w-[480px] overflow-hidden rounded-[10px] bg-white shadow-sm">
            <Section className="px-6 py-8">
              <Heading
                as="h1"
                className="mb-4 text-xl font-semibold text-zinc-900"
              >
                Verify your account
              </Heading>
              <Text className="mb-6 text-[15px] leading-6 text-zinc-700">
                Enter the verification code we when prompted:
              </Text>
              <Section className="mb-6 rounded-lg bg-zinc-100 p-6">
                <Text className="text-center text-[28px] font-semibold tracking-[8px] text-zinc-900">
                  {otp}
                </Text>
              </Section>
              <Text className="text-sm leading-5 text-zinc-500">
                The code expires in 10 minutes. To protect your account, do not
                share this code.
              </Text>
              <EmailSecurityNotice requestContext={requestContext} />
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

export default VerificationCodeEmail;
VerificationCodeEmail.PreviewProps = {
  appName: 'My App',
  otp: '123456',
  requestContext: {
    requestedAtUtc: '13 February 2026, 21:11 UTC',
    ip: '136.24.244.114',
    city: 'San Francisco',
    country: 'US',
  },
} satisfies VerificationCodeEmailProps;
