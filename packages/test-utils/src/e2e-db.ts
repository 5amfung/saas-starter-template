import { createDb } from '@/db/client';
import * as schema from '@/db/schema';

let dbSingleton: ReturnType<typeof createDb<typeof schema>> | null = null;

function loadEnvFileIfPresent(path: string): void {
  try {
    process.loadEnvFile(path);
  } catch {
    // Ignore missing env files and keep looking.
  }
}

function getDatabaseUrl(): string {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;

  loadEnvFileIfPresent(
    new URL('../../../apps/web/.env', import.meta.url).pathname
  );

  if (!process.env.DATABASE_URL) {
    throw new Error(
      'DATABASE_URL is required for E2E DB helpers. Checked apps/web/.env.'
    );
  }

  return process.env.DATABASE_URL;
}

export function getE2EDb() {
  dbSingleton ??= createDb(getDatabaseUrl(), schema);
  return dbSingleton;
}
