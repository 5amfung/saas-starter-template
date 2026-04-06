import { createFileRoute } from '@tanstack/react-router';
import { sql } from 'drizzle-orm';
import { getDb } from '@/init';

export const Route = createFileRoute('/health')({
  server: {
    handlers: {
      GET: async () => {
        const database = await checkDatabase();
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

async function checkDatabase() {
  try {
    await getDb().execute(sql`SELECT 1`);
    return { status: 'connected', latency: 0 };
  } catch (error) {
    return {
      status: 'error',
      error: error instanceof Error ? error.message : 'Unknown error.',
    };
  }
}
