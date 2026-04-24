import { expect, test } from '@playwright/test';
import { signInAsPlatformAdmin } from '../fixtures/admin-auth';

test.describe('admin baseline visual regression', () => {
  test.beforeEach(async ({ page }) => {
    await signInAsPlatformAdmin(page);
    await page.setViewportSize({ width: 1440, height: 1000 });
  });

  test('captures the admin dashboard shell', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByText('Total Verified Users')).toBeVisible();
    await expect(page.getByText('Monthly Active Users')).toBeVisible();

    await expect(page).toHaveScreenshot('admin-dashboard-shell.png', {
      fullPage: true,
      maxDiffPixelRatio: 0.02,
    });
  });

  test('captures the admin users table', async ({ page }) => {
    await page.goto('/users');
    await expect(page).toHaveURL(/\/users$/);
    await expect(
      page.getByRole('textbox', { name: 'Search by email...' })
    ).toBeVisible();
    await expect(page.getByRole('table')).toBeVisible();

    await expect(page).toHaveScreenshot('admin-users-table.png', {
      fullPage: true,
      maxDiffPixelRatio: 0.02,
    });
  });

  test('captures the admin workspaces table', async ({ page }) => {
    await page.goto('/workspaces');
    await expect(page).toHaveURL(/\/workspaces$/);
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
