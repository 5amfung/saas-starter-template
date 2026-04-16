import { expect, test } from '@playwright/test';
import { signInAsPlatformAdmin } from '../fixtures/admin-auth';
import { adminFixtures } from '../fixtures/admin-fixtures';

test.describe('Admin user detail', () => {
  test('user detail renders seeded user fields in read-only coverage', async ({
    page,
  }) => {
    await signInAsPlatformAdmin(page);
    await page.goto('/users');
    await page
      .getByPlaceholder(/search/i)
      .fill(adminFixtures.users.owner.email);
    await page.keyboard.press('Enter');
    await page
      .getByRole('link', {
        name: adminFixtures.users.owner.email,
        exact: true,
      })
      .click();
    await page.waitForURL(/\/users\/.+$/);

    await expect(page.getByRole('button', { name: 'Back' })).toBeVisible();
    await expect(page.getByRole('textbox', { name: 'Email' })).toHaveValue(
      adminFixtures.users.owner.email
    );
    await expect(page.getByRole('textbox', { name: 'Full Name' })).toHaveValue(
      adminFixtures.users.owner.name
    );
    await expect(page.getByText('Danger Zone')).toBeVisible();
  });
});
