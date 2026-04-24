import { expect, test } from '@playwright/test';
import { signInBaselineUser } from '@workspace/test-utils';
import { parseCookieHeader } from '../lib/parse-cookie-header';

test('verified non-admin sees access denied at /admin', async ({
  page,
  baseURL,
}) => {
  if (!baseURL) throw new Error('Playwright baseURL is required.');

  const { cookie } = await signInBaselineUser(baseURL, 'owner');
  await page
    .context()
    .addCookies(parseCookieHeader(cookie, new URL(baseURL).hostname));

  await page.goto('/admin');

  await expect(
    page.getByRole('heading', { name: /access denied/i })
  ).toBeVisible();
  await expect(
    page.getByText(/current account does not have admin access/i)
  ).toBeVisible();
});

test('non-admin can switch account from access denied state', async ({
  page,
  baseURL,
}) => {
  if (!baseURL) throw new Error('Playwright baseURL is required.');

  const { cookie } = await signInBaselineUser(baseURL, 'owner');
  await page
    .context()
    .addCookies(parseCookieHeader(cookie, new URL(baseURL).hostname));

  await page.goto('/admin');
  await page.getByRole('button', { name: /switch account/i }).click();

  await expect(page).toHaveURL(/\/signin\?redirect=%2Fadmin$/);
  await expect(page.getByText('Welcome back')).toBeVisible();
});
