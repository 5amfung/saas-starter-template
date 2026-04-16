import { seedE2EBaseline } from '@workspace/db-schema';

let didLoadEnv = false;

function ensureEnvLoaded() {
  if (didLoadEnv || process.env.DATABASE_URL) {
    didLoadEnv = true;
    return;
  }

  process.loadEnvFile(new URL('../../../.env', import.meta.url).pathname);
  didLoadEnv = true;
}

export async function resetAdminMutationState(): Promise<void> {
  ensureEnvLoaded();
  await seedE2EBaseline();
}
