import { expect, test } from '@playwright/test';
import { signInAsPlatformAdmin } from '../fixtures/admin-auth';
import { adminFixtures } from '../fixtures/admin-fixtures';
import { openAdminUserDetailByEmail } from '../fixtures/admin-navigation';

test.describe('Admin user dangerous actions', () => {
  test('platform admin cannot delete his own account from the danger zone', async ({
    page,
  }) => {
    await signInAsPlatformAdmin(page);
    await openAdminUserDetailByEmail(page, adminFixtures.platformAdmin.email);

    await expect(page.getByText('Danger Zone')).toBeVisible();
    await expect(
      page.getByText(/cannot delete your own account/i)
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Delete User' })
    ).toBeDisabled();
  });
});
