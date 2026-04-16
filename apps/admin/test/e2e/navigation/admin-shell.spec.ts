import { expect, test } from '@playwright/test';
import { signInAsPlatformAdmin } from '../fixtures/admin-auth';

test.describe('Admin shell navigation', () => {
  test('platform admin can navigate between protected shell routes', async ({
    page,
  }) => {
    await signInAsPlatformAdmin(page);

    await page.goto('/dashboard');

    await expect(
      page.getByRole('button', { name: /Admin Portal/i })
    ).toBeVisible();
    await expect(page.getByRole('link', { name: 'Dashboard' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Users' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Workspaces' })).toBeVisible();

    await page.getByRole('link', { name: 'Users' }).click();
    await page.waitForURL(/\/users$/);

    await page.getByRole('link', { name: 'Workspaces' }).click();
    await page.waitForURL(/\/workspaces$/);
  });
});
