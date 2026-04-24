import { expect, test } from '@playwright/test';
import { signInAsPlatformAdmin } from '../fixtures/admin-auth';
import { adminFixtures } from '../fixtures/admin-fixtures';

test.describe('Admin workspace detail', () => {
  test('workspace detail renders seeded workspace fields in read-only coverage', async ({
    page,
  }) => {
    await signInAsPlatformAdmin(page);
    await page.goto(
      `/admin/workspaces/${adminFixtures.workspaces.proOwner.organizationId}`
    );

    await expect(page.getByRole('button', { name: 'Back' })).toBeVisible();
    await expect(page.getByText('Workspace Info')).toBeVisible();
    await expect(page.getByText('Subscription', { exact: true })).toBeVisible();
    await expect(
      page.locator(`input[value="${adminFixtures.workspaces.proOwner.name}"]`)
    ).toBeVisible();
    await expect(
      page.locator(`input[value="${adminFixtures.workspaces.proOwner.slug}"]`)
    ).toBeVisible();
    await expect(
      page.locator(
        `input[value="${adminFixtures.workspaces.proOwner.organizationId}"]`
      )
    ).toBeVisible();
    await expect(
      page.getByText(adminFixtures.workspaces.proOwner.planId)
    ).toBeVisible();
    await expect(page.getByText('active')).toBeVisible();
  });
});
