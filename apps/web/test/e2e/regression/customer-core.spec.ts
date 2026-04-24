import { expect, test } from '@playwright/test';
import { signInBaselineUser } from '@workspace/test-utils';
import { parseCookieHeader } from '../lib/parse-cookie-header';

test.describe('customer core regression', () => {
  test('keeps shared auth pages available', async ({ page }) => {
    await page.goto('/signin');
    await expect(page).toHaveURL(/\/signin/);
    await expect(page.getByText('Welcome back')).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Sign in', exact: true })
    ).toBeVisible();

    await page.goto('/signup');
    await expect(page).toHaveURL(/\/signup/);
    await expect(
      page.getByText('Create your account', { exact: true })
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Create Account', exact: true })
    ).toBeVisible();
  });

  test('keeps account and workspace routes protected by the shared session', async ({
    page,
  }) => {
    await page.goto('/account');
    await expect(page).toHaveURL(/\/signin/);

    await page.goto('/ws');
    await expect(page).toHaveURL(/\/signin/);
  });

  test('keeps signed-in customers on the workspace entry path', async ({
    page,
    baseURL,
  }) => {
    if (!baseURL) throw new Error('Playwright baseURL is required.');

    const { cookie } = await signInBaselineUser(baseURL, 'owner');
    await page
      .context()
      .addCookies(parseCookieHeader(cookie, new URL(baseURL).hostname));

    await page.goto('/ws');
    await page.waitForURL(/\/ws\/.+\/overview/, { timeout: 10000 });
    await expect(page.locator('body')).toBeVisible();
  });
});
