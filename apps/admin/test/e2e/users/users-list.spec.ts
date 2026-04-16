import { expect, test } from '@playwright/test';
import { signInAsPlatformAdmin } from '../fixtures/admin-auth';
import { adminFixtures } from '../fixtures/admin-fixtures';

test.describe('Admin users list', () => {
  test('users list renders seeded users and supports read-only navigation', async ({
    page,
  }) => {
    await signInAsPlatformAdmin(page);
    await page.goto('/users');

    await expect(page.getByPlaceholder(/search/i)).toBeVisible();
    await page
      .getByPlaceholder(/search/i)
      .fill(adminFixtures.users.owner.email);
    await page.keyboard.press('Enter');

    await expect(
      page.getByRole('link', {
        name: adminFixtures.users.owner.email,
        exact: true,
      })
    ).toBeVisible();

    await page.getByRole('button', { name: /clear search/i }).click();
    await page
      .getByPlaceholder(/search/i)
      .fill(adminFixtures.users.member.email);
    await page.keyboard.press('Enter');

    await expect(
      page.getByRole('link', {
        name: adminFixtures.users.member.email,
        exact: true,
      })
    ).toBeVisible();

    await page.getByRole('button', { name: /clear search/i }).click();
    await page.getByRole('tab', { name: 'Verified', exact: true }).click();
    await page
      .getByPlaceholder(/search/i)
      .fill(adminFixtures.users.verified.email);
    await page.keyboard.press('Enter');

    await expect(
      page.getByRole('link', {
        name: adminFixtures.users.verified.email,
        exact: true,
      })
    ).toBeVisible();
    await expect(
      page.getByRole('link', {
        name: adminFixtures.users.unverified.email,
        exact: true,
      })
    ).toHaveCount(0);

    await page.getByRole('button', { name: /clear search/i }).click();
    await page.getByRole('tab', { name: 'Unverified', exact: true }).click();
    await page
      .getByPlaceholder(/search/i)
      .fill(adminFixtures.users.unverified.email);
    await page.keyboard.press('Enter');

    await expect(
      page.getByRole('link', {
        name: adminFixtures.users.unverified.email,
        exact: true,
      })
    ).toBeVisible();
    await expect(
      page.getByRole('link', {
        name: adminFixtures.users.verified.email,
        exact: true,
      })
    ).toHaveCount(0);

    await page.getByRole('button', { name: /clear search/i }).click();
    await page.getByRole('tab', { name: 'Banned', exact: true }).click();
    await page
      .getByPlaceholder(/search/i)
      .fill(adminFixtures.users.banned.email);
    await page.keyboard.press('Enter');

    await expect(
      page.getByRole('link', {
        name: adminFixtures.users.banned.email,
        exact: true,
      })
    ).toBeVisible();
    await expect(
      page.locator('tbody').getByText('Banned', { exact: true })
    ).toBeVisible();
  });
});
