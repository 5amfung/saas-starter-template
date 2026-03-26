import { createFileRoute } from '@tanstack/react-router';
import type { MockEmailClient } from '@workspace/email';
import { emailClient } from '@/init';

function isMockEmailClient(client: unknown): client is MockEmailClient {
  return (
    typeof client === 'object' &&
    client !== null &&
    'getEmailsFor' in client &&
    typeof (client as MockEmailClient).getEmailsFor === 'function'
  );
}

function getMockClient(): MockEmailClient | null {
  if (process.env.NODE_ENV !== 'test' || !isMockEmailClient(emailClient)) {
    return null;
  }
  return emailClient;
}

function handleGet(request: Request): Response {
  const client = getMockClient();
  if (!client) return new Response('Not Found', { status: 404 });

  const url = new URL(request.url);
  const to = url.searchParams.get('to');

  if (!to) {
    return Response.json(
      { error: 'Missing required query parameter: to' },
      { status: 400 }
    );
  }

  const emails = client.getEmailsFor(to).map((email) => ({
    to: email.to,
    subject: email.subject,
    verificationUrl:
      ((email.react.props as Record<string, unknown>)
        ?.verificationUrl as string) ?? null,
    sentAt: email.sentAt.toISOString(),
  }));

  return Response.json({ emails });
}

function handleDelete(request: Request): Response {
  const client = getMockClient();
  if (!client) return new Response('Not Found', { status: 404 });

  const url = new URL(request.url);
  const to = url.searchParams.get('to');

  if (!to) {
    return Response.json(
      { error: 'Missing required query parameter: to' },
      { status: 400 }
    );
  }

  client.clearEmailsFor(to);
  return Response.json({ cleared: true });
}

export const Route = createFileRoute('/api/test/emails')({
  server: {
    handlers: {
      GET: async ({ request }: { request: Request }) => handleGet(request),
      DELETE: async ({ request }: { request: Request }) =>
        handleDelete(request),
    },
  },
});
