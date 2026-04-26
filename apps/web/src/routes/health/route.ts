import { createFileRoute } from '@tanstack/react-router';
import { checkDatabaseHealth } from './-health.server';

export const Route = createFileRoute('/health')({
  server: {
    handlers: {
      GET: async () => {
        const database = await checkDatabaseHealth();
        const checks = {
          status: database.status === 'connected' ? 'healthy' : 'error',
          timestamp: new Date().toISOString(),
          uptime: process.uptime(),
          memory: process.memoryUsage(),
          database,
        };

        return Response.json(checks);
      },
    },
  },
});
