import { expect, test } from '@playwright/test';
import { signInAsPlatformAdmin } from '../fixtures/admin-auth';
import { adminFixtures } from '../fixtures/admin-fixtures';

test.describe('Admin workspace entitlements', () => {
  test('platform admin can update enterprise entitlement overrides and see persisted state after reload', async ({
    page,
  }) => {
    const workspace = adminFixtures.mutations.enterpriseWorkspace;
    const updatedNotes = 'Wave 2 entitlement override note';

    await signInAsPlatformAdmin(page);
    await page.goto(`/workspaces/${workspace.organizationId}`);

    await expect(page.getByText('Entitlement Overrides')).toBeVisible();

    await page
      .getByRole('combobox', { name: 'Priority Support' })
      .selectOption({
        value: 'disabled',
      });
    await page.getByLabel('Notes').fill(updatedNotes);
    await page.getByRole('button', { name: 'Save Overrides' }).click();

    await expect(page.getByText('Entitlement overrides saved.')).toBeVisible();
    await expect(
      page.getByRole('combobox', { name: 'Priority Support' })
    ).toHaveValue('disabled');
    await expect(page.getByLabel('Notes')).toHaveValue(updatedNotes);

    await page.reload();

    await expect(
      page.getByRole('combobox', { name: 'Priority Support' })
    ).toHaveValue('disabled');
    await expect(page.getByLabel('Notes')).toHaveValue(updatedNotes);
  });
});
