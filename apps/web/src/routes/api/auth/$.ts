import { createFileRoute } from '@tanstack/react-router';
import { getAuth } from '@/init';
import { requestLogger } from '@/lib/logger';

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
