import { signInSeededUser } from '@workspace/test-utils';
import { parseCookieHeader } from '../../lib/parse-cookie-header';
import type { Page } from '@playwright/test';
import { E2E_PASSWORD, E2E_PLATFORM_ADMIN } from '@/db/seed/e2e-fixtures';

function getBaseUrl(): string {
  return process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000';
}

export async function signInAsPlatformAdmin(page: Page): Promise<void> {
  const baseUrl = getBaseUrl();
  const { cookie } = await signInSeededUser(baseUrl, {
    email: E2E_PLATFORM_ADMIN.email,
    password: E2E_PASSWORD,
  });

  await page
    .context()
    .addCookies(parseCookieHeader(cookie, new URL(baseUrl).hostname));
}
