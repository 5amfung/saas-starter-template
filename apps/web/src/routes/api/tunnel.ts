import { createFileRoute } from '@tanstack/react-router';
import {
  buildSentryEnvelopeUrl,
  getSentryEnvelopeHeader,
} from '@/observability/sentry-tunnel.server';
import { requestLogger } from '@/observability/server';

type SentryTunnelRouteArgs = {
  request: Request;
};

function getBrowserSentryDsn(): string | undefined {
  return process.env.VITE_SENTRY_DSN?.trim() || undefined;
}

async function handlePost(request: Request): Promise<Response> {
  const configuredDsn = getBrowserSentryDsn();

  if (!configuredDsn) {
    return Response.json(
      { error: 'Sentry tunnel is not configured' },
      { status: 503 }
    );
  }

  const envelopeBytes = await request.arrayBuffer();
  const envelopeHeader = getSentryEnvelopeHeader(envelopeBytes);
  let upstreamUrl: string;

  try {
    upstreamUrl = buildSentryEnvelopeUrl({
      configuredDsn,
      envelopeHeader,
    });
  } catch (error) {
    console.error('Invalid Sentry envelope', error);
    return Response.json({ error: 'Invalid Sentry envelope' }, { status: 400 });
  }

  try {
    const upstreamResponse = await fetch(upstreamUrl, {
      body: envelopeBytes,
      method: 'POST',
    });

    if (!upstreamResponse.ok) {
      console.error(
        `Sentry tunnel upstream failed with status ${upstreamResponse.status}`
      );
    }

    return new Response(upstreamResponse.body, {
      headers: upstreamResponse.headers,
      status: upstreamResponse.status,
      statusText: upstreamResponse.statusText,
    });
  } catch (error) {
    console.error('Error tunneling to Sentry', error);
    return Response.json(
      { error: 'Error tunneling to Sentry' },
      { status: 502 }
    );
  }
}

export const Route = createFileRoute('/api/tunnel')({
  server: {
    middleware: [requestLogger],
    handlers: {
      POST: ({ request }: SentryTunnelRouteArgs) => handlePost(request),
    },
  },
});
