import { expect, test } from '@playwright/test';
import { E2E_PASSWORD, E2E_PLATFORM_ADMIN } from '@workspace/db-schema';

test.describe('Admin user detail direct load', () => {
  test('loads and survives a hard refresh for a valid user id', async ({
    page,
  }) => {
    await page.goto('/signin');
    await page.getByLabel('Email').fill(E2E_PLATFORM_ADMIN.email);
    await page.getByLabel('Password').fill(E2E_PASSWORD);
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();

    await page.waitForURL(/\/dashboard/, { timeout: 10000 });

    const userDetailPath = `/users/${E2E_PLATFORM_ADMIN.userId}`;

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
