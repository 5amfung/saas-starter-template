import { E2E_PASSWORD, E2E_PLATFORM_ADMIN } from '@workspace/db-schema';
import { signInSeededUser } from '@workspace/test-utils';
import type { Page } from '@playwright/test';

function getBaseUrl(): string {
  return process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3001';
}

function parseCookieHeader(raw: string, domain = 'localhost') {
  const [cookiePair] = raw.split(';');
  const separatorIndex = cookiePair.indexOf('=');

  return {
    name: cookiePair.slice(0, separatorIndex).trim(),
    value: cookiePair.slice(separatorIndex + 1).trim(),
    domain,
    path: '/',
    httpOnly: true,
    secure: false,
    sameSite: 'Lax' as const,
  };
}

export async function signInAsPlatformAdmin(page: Page): Promise<void> {
  const { cookie } = await signInSeededUser(getBaseUrl(), {
    email: E2E_PLATFORM_ADMIN.email,
    password: E2E_PASSWORD,
  });

  await page.context().addCookies([parseCookieHeader(cookie)]);
}
