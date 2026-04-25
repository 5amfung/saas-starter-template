import { expect, test } from '@playwright/test';
import { signInAsPlatformAdmin } from '../fixtures/admin-auth';
import { E2E_PLATFORM_ADMIN } from '@/db/seed/e2e-fixtures';

test.describe('Admin user detail direct load', () => {
  test('loads and survives a hard refresh for a valid user id', async ({
    page,
  }) => {
    await signInAsPlatformAdmin(page);

    const userDetailPath = `/admin/users/${E2E_PLATFORM_ADMIN.userId}`;

    await page.goto(userDetailPath);
    await expect(page).toHaveURL(new RegExp(`${userDetailPath}$`));
    await expect(page.getByLabel('User ID')).toHaveValue(
      E2E_PLATFORM_ADMIN.userId
    );
    await expect(page.getByLabel('Email')).toHaveValue(
      E2E_PLATFORM_ADMIN.email
    );
    await expect(page.getByText('Page Not Found')).toHaveCount(0);

    await page.reload();

    await expect(page).toHaveURL(new RegExp(`${userDetailPath}$`));
    await expect(page.getByLabel('User ID')).toHaveValue(
      E2E_PLATFORM_ADMIN.userId
    );
    await expect(page.getByLabel('Email')).toHaveValue(
      E2E_PLATFORM_ADMIN.email
    );
    await expect(page.getByText('Page Not Found')).toHaveCount(0);
  });
});
