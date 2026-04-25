import type { FullConfig } from '@playwright/test';
import { seedE2EBaseline } from '@/db/seed/seed-e2e-baseline';

/**
 * Playwright globalSetup that verifies the server is using the mock email
 * client before any E2E test runs.
 *
 * The mock email client is active only when the server starts with
 * E2E_MOCK_EMAIL=true. If someone runs tests against a manually-started dev
 * server without this flag, this check fails fast — preventing real Resend
 * API calls that cost money.
 */
export default async function globalSetup(config: FullConfig): Promise<void> {
  const baseURL = config.projects[0]?.use?.baseURL ?? 'http://localhost:3000';

  process.loadEnvFile(new URL('../../.env', import.meta.url).pathname);

  const probeURL = `${baseURL}/api/test/emails?to=probe@test.local`;

  let response: Response;
  try {
    response = await fetch(probeURL);
  } catch (error) {
    throw new Error(
      `E2E safeguard: Could not reach ${probeURL}. ` +
        `Is the server running? (${error instanceof Error ? error.message : String(error)})`
    );
  }

  if (!response.ok) {
    throw new Error(
      'E2E safeguard failed: The server is not using the mock email client.\n\n' +
        `  GET ${probeURL} returned ${response.status}.\n\n` +
        '  The mock email client is only active when E2E_MOCK_EMAIL=true.\n' +
        '  Without it, E2E tests will send real emails via Resend.\n\n' +
        '  Fix: Restart the server with E2E_MOCK_EMAIL=true, or let Playwright\n' +
        '  manage the server (remove reuseExistingServer or stop your dev server).'
    );
  }

  await seedE2EBaseline();
}
