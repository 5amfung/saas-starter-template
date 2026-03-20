import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/ping')({
  server: {
    handlers: {
      GET: () => {
        return new Response('pong');
      },
    },
  },
});
