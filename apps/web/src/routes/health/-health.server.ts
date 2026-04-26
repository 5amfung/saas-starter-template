import { sql } from 'drizzle-orm';
import { getDb } from '@/init.server';

export async function checkDatabaseHealth() {
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
