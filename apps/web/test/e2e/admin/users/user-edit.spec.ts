import { expect, test } from '@playwright/test';
import { signInAsPlatformAdmin } from '../fixtures/admin-auth';
import { adminFixtures } from '../fixtures/admin-fixtures';
import { openAdminUserDetail } from '../fixtures/admin-navigation';

test.describe('Admin user edit', () => {
  test('platform admin can edit a seeded user and see persisted changes after reload', async ({
    page,
  }) => {
    const user = adminFixtures.mutations.editableUser;
    const updatedName = 'E2E Editable User Updated';

    await signInAsPlatformAdmin(page);
    await openAdminUserDetail(page, user.userId);

    await page.getByRole('textbox', { name: 'Full Name' }).fill(updatedName);
    await page.getByRole('button', { name: /save changes/i }).click();
    await expect(page.getByText('User updated successfully.')).toBeVisible();

    await expect(page.getByRole('textbox', { name: 'Full Name' })).toHaveValue(
      updatedName
    );

    await page.reload();
    await expect(page).toHaveURL(new RegExp(`/admin/users/${user.userId}$`));

    await expect(page.getByRole('textbox', { name: 'Full Name' })).toHaveValue(
      updatedName
    );
  });
});
