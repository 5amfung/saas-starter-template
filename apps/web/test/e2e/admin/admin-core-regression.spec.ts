import { expect, test } from '@playwright/test';
import { signInAsPlatformAdmin } from './fixtures/admin-auth';

test.describe('admin core regression', () => {
  test('redirects unauthenticated admin users to shared signin with admin intent', async ({
    page,
  }) => {
    await page.goto('/admin/dashboard');

    await expect(page).toHaveURL(/\/signin/);
    await expect(page).toHaveURL(
      /redirect=%2Fadmin%2Fdashboard|redirect=\/admin\/dashboard/
    );
  });

  test('does not expose admin-specific auth routes', async ({ page }) => {
    const adminSigninResponse = await page.goto('/admin/signin');
    if (page.url().endsWith('/admin/signin')) {
      expect(adminSigninResponse?.status()).toBe(404);
    } else {
      await expect(page).toHaveURL(/\/signin/);
    }

    const adminSignupResponse = await page.goto('/admin/signup');
    if (page.url().endsWith('/admin/signup')) {
      expect(adminSignupResponse?.status()).toBe(404);
    } else {
      await expect(page).toHaveURL(/\/signup|\/signin/);
    }

    const adminVerifyResponse = await page.goto('/admin/verify');
    if (page.url().endsWith('/admin/verify')) {
      expect(adminVerifyResponse?.status()).toBe(404);
    } else {
      await expect(page).toHaveURL(/\/verify|\/signin/);
    }
  });

  test('loads core admin pages for a platform admin', async ({ page }) => {
    await signInAsPlatformAdmin(page);

    await page.goto('/admin/dashboard');
    await expect(page).toHaveURL(/\/admin\/dashboard$/);
    await expect(page.locator('body')).toBeVisible();

    await page.goto('/admin/users');
    await expect(page).toHaveURL(/\/admin\/users$/);
    await expect(page.locator('body')).toBeVisible();

    await page.goto('/admin/workspaces');
    await expect(page).toHaveURL(/\/admin\/workspaces$/);
    await expect(page.locator('body')).toBeVisible();
  });
});
