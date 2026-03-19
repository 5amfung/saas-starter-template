/**
 *  Server-only: used when rendering emails; do not import from client code.
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
} from "@react-email/components"
import { EmailSecurityNotice } from "./email-security-notice"
import type { EmailRequestContext } from "../request-context"

export interface ResetPasswordEmailProps {
  appName: string
  resetUrl: string
  requestContext: EmailRequestContext
}

export function ResetPasswordEmail({
  appName,
  resetUrl,
  requestContext,
}: ResetPasswordEmailProps) {
  return (
    <Html lang="en" dir="ltr">
      <Head />
      <Preview>Reset your password</Preview>
      <Tailwind config={{ presets: [pixelBasedPreset] }}>
        <Body className="bg-zinc-100 p-8 px-4 font-sans">
          <Container className="mx-auto max-w-[480px] overflow-hidden rounded-[10px] bg-white shadow-sm">
            <Section className="px-6 py-8">
              <Heading
                as="h1"
                className="mb-4 text-xl font-semibold text-zinc-900"
              >
                Reset your password
              </Heading>
              <Text className="mb-6 text-[15px] leading-6 text-zinc-700">
                If an account exists for your email, click the button below to
                reset your password.
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
              <EmailSecurityNotice requestContext={requestContext} />
            </Section>
            <Section className="border-t border-zinc-200 p-6">
              <Text className="text-xs text-zinc-400">{appName}</Text>
            </Section>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  )
}

export default ResetPasswordEmail
ResetPasswordEmail.PreviewProps = {
  appName: "My App",
  resetUrl: "https://example.com/reset-password?token=abc123",
  requestContext: {
    requestedAtUtc: "13 February 2026, 21:11 UTC",
    ip: "136.24.244.114",
    city: "San Francisco",
    country: "US",
  },
} satisfies ResetPasswordEmailProps
