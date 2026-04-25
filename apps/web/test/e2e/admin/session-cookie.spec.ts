import { expect, test } from '@playwright/test';
import { signInSeededUser } from '@workspace/test-utils';
import { parseCookieHeader } from '../lib/parse-cookie-header';
import { E2E_PASSWORD, E2E_PLATFORM_ADMIN } from '@/db/seed/e2e-fixtures';

test('signing out clears access to both admin and customer routes', async ({
  page,
  baseURL,
}) => {
  if (!baseURL) throw new Error('Playwright baseURL is required.');

  const { cookie } = await signInSeededUser(baseURL, {
    email: E2E_PLATFORM_ADMIN.email,
    password: E2E_PASSWORD,
  });

  await page
    .context()
    .addCookies(parseCookieHeader(cookie, new URL(baseURL).hostname));

  await page.goto('/admin/dashboard');
  await expect(page).toHaveURL(/\/admin\/dashboard/);
  await expect(page.getByText(E2E_PLATFORM_ADMIN.email)).toBeVisible();

  await page
    .getByRole('button', { name: /platform-admin@e2e\.local/i })
    .click();
  await page.getByRole('menuitem', { name: /log out/i }).click();

  await page.goto('/admin/dashboard');
  await expect(page).toHaveURL(/\/signin/);
  await expect(page).toHaveURL(/redirect=%2Fadmin%2Fdashboard/);

  await page.goto('/ws');
  await expect(page).toHaveURL(/\/signin/);
});
