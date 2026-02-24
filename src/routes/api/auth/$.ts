import { createFileRoute } from '@tanstack/react-router';
import { auth } from '@/auth/auth.server';

export const Route = createFileRoute('/api/auth/$')({
  server: {
    // TODO: Add request logger here.
    // middleware: [requestLogger],
    handlers: {
      GET: async ({ request }: { request: Request }) => {
        return await auth.handler(request);
      },
      POST: async ({ request }: { request: Request }) => {
        return await auth.handler(request);
      },
    },
  },
});
