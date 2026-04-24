import { expect, test } from '@playwright/test';
import { signInBaselineUser } from '@workspace/test-utils';
import { signInAsPlatformAdmin } from '../admin/fixtures/admin-auth';
import { parseCookieHeader } from '../lib/parse-cookie-header';

test.describe('visual shell regression', () => {
  test('customer auth shell remains stable', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto('/signin');
    await expect(page.getByText('Welcome back')).toBeVisible();

    await expect(page).toHaveScreenshot('customer-signin-shell.png', {
      fullPage: true,
      maxDiffPixelRatio: 0.02,
    });
  });

  test('customer workspace shell remains stable', async ({ page, baseURL }) => {
    if (!baseURL) throw new Error('Playwright baseURL is required.');

    const { cookie } = await signInBaselineUser(baseURL, 'owner');
    await page
      .context()
      .addCookies(parseCookieHeader(cookie, new URL(baseURL).hostname));

    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto('/ws');
    await page.waitForURL(/\/ws\/.+\/overview/, { timeout: 10000 });
    await expect(page.locator('body')).toBeVisible();

    await expect(page).toHaveScreenshot('customer-workspace-shell.png', {
      fullPage: true,
      maxDiffPixelRatio: 0.02,
    });
  });

  test('admin access denied shell remains stable', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto('/admin/access-denied');
    await expect(
      page.getByRole('heading', { name: /access denied/i })
    ).toBeVisible();

    await expect(page).toHaveScreenshot('admin-access-denied-shell.png', {
      fullPage: true,
      maxDiffPixelRatio: 0.02,
    });
  });

  test.describe('authenticated admin shells', () => {
    test.beforeEach(async ({ page }) => {
      await signInAsPlatformAdmin(page);
      await page.setViewportSize({ width: 1440, height: 1000 });
    });

    test('admin dashboard shell remains stable', async ({ page }) => {
      await page.goto('/admin/dashboard');
      await expect(page).toHaveURL(/\/admin\/dashboard$/);
      await expect(page.getByText('Total Verified Users')).toBeVisible();
      await expect(page.getByText('Monthly Active Users')).toBeVisible();

      await expect(page).toHaveScreenshot('admin-dashboard-shell.png', {
        fullPage: true,
        maxDiffPixelRatio: 0.02,
      });
    });

    test('admin users table remains stable', async ({ page }) => {
      await page.goto('/admin/users');
      await expect(page).toHaveURL(/\/admin\/users$/);
      await expect(
        page.getByRole('textbox', { name: 'Search by email...' })
      ).toBeVisible();
      await expect(page.getByRole('table')).toBeVisible();

      await expect(page).toHaveScreenshot('admin-users-table.png', {
        fullPage: true,
        maxDiffPixelRatio: 0.02,
      });
    });

    test('admin workspaces table remains stable', async ({ page }) => {
      await page.goto('/admin/workspaces');
      await expect(page).toHaveURL(/\/admin\/workspaces$/);
      await expect(
        page.getByRole('textbox', { name: 'Search by name or email...' })
      ).toBeVisible();
      await expect(page.getByRole('table')).toBeVisible();

      await expect(page).toHaveScreenshot('admin-workspaces-table.png', {
        fullPage: true,
        maxDiffPixelRatio: 0.02,
      });
    });
  });
});
