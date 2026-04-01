import { createFileRoute } from '@tanstack/react-router';
import { extractEmailLinks } from '@workspace/components/lib';
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
  if (
    process.env.E2E_MOCK_EMAIL !== 'true' ||
    !isMockEmailClient(emailClient)
  ) {
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
    ...extractEmailLinks(email.react),
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
      // eslint-disable-next-line @typescript-eslint/require-await
      GET: async ({ request }: { request: Request }) => handleGet(request),
      // eslint-disable-next-line @typescript-eslint/require-await
      DELETE: async ({ request }: { request: Request }) =>
        handleDelete(request),
    },
  },
});
