/**
 * Server-only: used when rendering emails; do not import from client code.
 */
import { Section, Text } from '@react-email/components';
import type { EmailRequestContext } from '@/email/email-request-context.server';

const SECURITY_HEADING = "Didn't request this?";
const REASSURANCE_SENTENCE =
  "If you didn't make this request, you can safely ignore this email.";

function buildOriginSentence(context: EmailRequestContext): string {
  const location = [context.city, context.country].filter(Boolean).join(', ');
  const fromPart = context.ip
    ? location
      ? `${context.ip}, ${location}`
      : context.ip
    : null;
  return fromPart
    ? `This request was made from ${fromPart} at ${context.requestedAtUtc}.`
    : `This request was made at ${context.requestedAtUtc}.`;
}

export interface EmailSecurityNoticeProps {
  requestContext: EmailRequestContext;
}

export function EmailSecurityNotice({
  requestContext,
}: EmailSecurityNoticeProps) {
  const originSentence = buildOriginSentence(requestContext);

  return (
    <Section className="mt-6">
      <Text className="mb-1 text-sm font-medium text-zinc-700">
        {SECURITY_HEADING}
      </Text>
      <Text className="mb-2 text-sm leading-5 text-zinc-500">
        {originSentence} {REASSURANCE_SENTENCE}
      </Text>
    </Section>
  );
}
