import type { FullConfig } from '@playwright/test';

/**
 * Fast startup guard for Admin E2E runs.
 *
 * This only checks that the configured base URL is reachable before Playwright
 * starts the browser suite. We intentionally keep it small so the harness stays
 * lightweight and does not depend on app-specific test fixtures yet.
 */
export default async function globalSetup(config: FullConfig): Promise<void> {
  const baseURL = config.projects[0]?.use?.baseURL ?? 'http://localhost:3001';
  const probeURL = `${baseURL}/api/test/emails?to=probe@test.local`;

  let response: Response;
  try {
    response = await fetch(probeURL);
  } catch (error) {
    throw new Error(
      `E2E safeguard: Could not reach ${probeURL}. ` +
        `Is the Admin server running? (${error instanceof Error ? error.message : String(error)})`
    );
  }

  if (!response.ok) {
    await response.body?.cancel();
    throw new Error(
      'E2E safeguard failed: The Admin server is not using the mock email client.\n\n' +
        `  GET ${probeURL} returned ${response.status}.\n\n` +
        '  The mock email client is only active when E2E_MOCK_EMAIL=true.\n' +
        '  Without it, E2E tests may send real emails.\n\n' +
        '  Fix: Restart the server with E2E_MOCK_EMAIL=true, or let Playwright\n' +
        '  manage the server (remove reuseExistingServer or stop your dev server).'
    );
  }

  await response.arrayBuffer();
}
