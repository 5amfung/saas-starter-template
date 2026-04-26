import * as fs from 'node:fs';

const LOCAL_E2E_ENV_PATH = new URL(
  '../../../apps/web/.env.local',
  import.meta.url
).pathname;

export function resolveE2EDatabaseUrl(consumer = 'E2E DB helpers'): string {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;

  if (!process.env.CI && fs.existsSync(LOCAL_E2E_ENV_PATH)) {
    process.loadEnvFile(LOCAL_E2E_ENV_PATH);
  }

  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;

  if (process.env.CI) {
    throw new Error(
      `DATABASE_URL is required for ${consumer} in CI. ` +
        'Set it in the workflow environment.'
    );
  }

  throw new Error(
    `DATABASE_URL is required for ${consumer}. Checked apps/web/.env.local.`
  );
}
