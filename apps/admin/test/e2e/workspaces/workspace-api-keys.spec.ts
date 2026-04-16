import { expect, test } from '@playwright/test';
import { signInAsPlatformAdmin } from '../fixtures/admin-auth';
import { adminFixtures } from '../fixtures/admin-fixtures';
import { openAdminWorkspaceDetail } from '../fixtures/admin-navigation';
import type { Page } from '@playwright/test';

async function deleteAllWorkspaceApiKeys(page: Page): Promise<void> {
  const deleteButtons = page.getByRole('button', { name: 'Delete' });

  while ((await deleteButtons.count()) > 0) {
    await deleteButtons.first().click();
    await expect(page.getByText('Delete API key')).toBeVisible();
    const confirmDeleteButton = page
      .getByRole('alertdialog')
      .getByRole('button', { name: 'Delete' });
    await expect(confirmDeleteButton).toBeVisible();
    await confirmDeleteButton.click({ force: true });
    await expect(page.getByText('Workspace API key deleted.')).toBeVisible();
    await expect(page.getByRole('alertdialog')).not.toBeVisible();
  }
}

test.describe('Admin workspace API keys', () => {
  test('platform admin can create and delete a workspace API key', async ({
    page,
  }) => {
    const workspace = adminFixtures.mutations.enterpriseWorkspace;

    await signInAsPlatformAdmin(page);
    await openAdminWorkspaceDetail(page, workspace.organizationId);

    await expect(page.getByText('API Keys', { exact: true })).toBeVisible();
    await deleteAllWorkspaceApiKeys(page);
    await expect(
      page.getByText('No workspace-owned API keys yet.')
    ).toBeVisible();

    await page.getByRole('button', { name: 'Generate new key' }).click();
    await page.getByLabel('Read and Write').check();
    await page.getByRole('button', { name: 'Save' }).click();

    await expect(page.getByText('Workspace API key created.')).toBeVisible();
    await expect(
      page.getByRole('textbox', { name: 'Generated API key' })
    ).toHaveValue(/^srw_/);
    await expect(page.getByText('Read & Write API Key')).toBeVisible();

    await page.getByRole('button', { name: 'Delete' }).click();
    await expect(page.getByText('Delete API key')).toBeVisible();
    const confirmDeleteButton = page
      .getByRole('alertdialog')
      .getByRole('button', { name: 'Delete' });
    await expect(confirmDeleteButton).toBeVisible();
    await confirmDeleteButton.click({ force: true });

    await expect(page.getByText('Workspace API key deleted.')).toBeVisible();
    await expect(
      page.getByText('No workspace-owned API keys yet.')
    ).toBeVisible();
  });
});
