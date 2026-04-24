import { expect, test } from '@playwright/test';
import { signInBaselineUser } from '@workspace/test-utils';
import { parseCookieHeader } from '../lib/parse-cookie-header';

test.describe('web baseline visual regression', () => {
  test('captures the customer signin shell', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto('/signin');
    await expect(page.getByText('Welcome back')).toBeVisible();

    await expect(page).toHaveScreenshot('web-signin-shell.png', {
      fullPage: true,
      maxDiffPixelRatio: 0.02,
    });
  });

  test('captures the customer workspace shell', async ({ page, baseURL }) => {
    if (!baseURL) throw new Error('Playwright baseURL is required.');

    const { cookie } = await signInBaselineUser(baseURL, 'owner');
    await page.context().addCookies(parseCookieHeader(cookie));

    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto('/ws');
    await page.waitForURL(/\/ws\/.+\/overview/, { timeout: 10000 });
    await expect(page.locator('body')).toBeVisible();

    await expect(page).toHaveScreenshot('web-workspace-shell.png', {
      fullPage: true,
      maxDiffPixelRatio: 0.02,
    });
  });
});
