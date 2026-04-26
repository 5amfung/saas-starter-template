import { createFileRoute } from '@tanstack/react-router';
import { requestLogger } from '@/observability/server';
import { getAuth } from '@/init.server';

export const Route = createFileRoute('/api/auth/$')({
  server: {
    middleware: [requestLogger],
    handlers: {
      GET: async ({ request }: { request: Request }) => {
        return await getAuth().handler(request);
      },
      POST: async ({ request }: { request: Request }) => {
        return await getAuth().handler(request);
      },
    },
  },
});
