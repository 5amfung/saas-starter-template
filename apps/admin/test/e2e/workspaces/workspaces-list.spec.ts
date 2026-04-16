import { expect, test } from '@playwright/test';
import { signInAsPlatformAdmin } from '../fixtures/admin-auth';
import { adminFixtures } from '../fixtures/admin-fixtures';

test.describe('Admin workspaces list', () => {
  test('workspaces list renders seeded workspaces and supports read-only navigation', async ({
    page,
  }) => {
    await signInAsPlatformAdmin(page);
    await page.goto('/workspaces');

    await expect(
      page.getByPlaceholder(/search by name or email/i)
    ).toBeVisible();

    await page
      .getByPlaceholder(/search by name or email/i)
      .fill(adminFixtures.workspaces.owner.name);
    await page.keyboard.press('Enter');

    await expect(
      page.getByRole('link', {
        name: adminFixtures.workspaces.owner.name,
        exact: true,
      })
    ).toBeVisible();
    await expect(
      page.getByRole('link', {
        name: adminFixtures.workspaces.proOwner.name,
        exact: true,
      })
    ).toHaveCount(0);

    await page.getByRole('button', { name: /clear search/i }).click();

    await page
      .getByPlaceholder(/search by name or email/i)
      .fill(adminFixtures.workspaces.proOwner.name);
    await page.keyboard.press('Enter');

    await expect(
      page.getByRole('link', {
        name: adminFixtures.workspaces.proOwner.name,
        exact: true,
      })
    ).toBeVisible();
    await expect(
      page.getByRole('link', {
        name: adminFixtures.workspaces.owner.name,
        exact: true,
      })
    ).toHaveCount(0);

    await page.getByRole('button', { name: /clear search/i }).click();
    await page.getByRole('tab', { name: 'Enterprise', exact: true }).click();

    await expect(
      page.getByRole('link', {
        name: adminFixtures.workspaces.enterprise.name,
        exact: true,
      })
    ).toBeVisible();
    await expect(
      page.getByRole('link', {
        name: adminFixtures.workspaces.owner.name,
        exact: true,
      })
    ).toHaveCount(0);

    await page
      .getByRole('link', {
        name: adminFixtures.workspaces.enterprise.name,
        exact: true,
      })
      .click();
    await page.waitForURL(/\/workspaces\/.+$/);
  });
});
