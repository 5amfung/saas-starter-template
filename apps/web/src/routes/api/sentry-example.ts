import { createFileRoute } from '@tanstack/react-router';
import { requestLogger } from '@workspace/logging/server';

export const Route = createFileRoute('/api/sentry-example')({
  server: {
    middleware: [requestLogger],
    handlers: {
      GET: () => {
        throw new Error('Sentry Example Route Error');
        return new Response(
          JSON.stringify({ message: 'Testing Sentry Error...' }),
          {
            headers: {
              'Content-Type': 'application/json',
            },
          }
        );
      },
    },
  },
});
