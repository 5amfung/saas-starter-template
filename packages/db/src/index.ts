import { Pool } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';

export function createDb<TSchema extends Record<string, unknown>>(
  connectionString: string,
  schema: TSchema
) {
  const pool = new Pool({
    connectionString,
    max: 20,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
  });
  return drizzle(pool, { schema });
}

export type Database = ReturnType<typeof createDb>;
