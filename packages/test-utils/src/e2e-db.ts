import { resolveE2EDatabaseUrl } from './e2e-database-url';
import { createDb } from '@/db/client';
import * as schema from '@/db/schema';

let dbSingleton: ReturnType<typeof createDb<typeof schema>> | null = null;

export function getE2EDb() {
  dbSingleton ??= createDb(resolveE2EDatabaseUrl(), schema);
  return dbSingleton;
}
