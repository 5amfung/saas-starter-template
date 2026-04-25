import { expect, test } from '@playwright/test';
import { E2E_PASSWORD, E2E_PLATFORM_ADMIN } from '@/db/seed/e2e-fixtures';

test.describe('Admin sign-in flow', () => {
  test('seeded platform admin user can sign in and reach the protected admin shell', async ({
    page,
  }) => {
    await page.goto('/signin?redirect=/admin/dashboard');
    await expect(page.getByLabel('Email')).toBeVisible();

    await page.getByLabel('Email').fill(E2E_PLATFORM_ADMIN.email);
    await page.getByLabel('Password').fill(E2E_PASSWORD);
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();

    await page.waitForURL(/\/admin\/dashboard/, { timeout: 10000 });

    await expect(
      page.getByRole('button', { name: /Admin Portal/i })
    ).toBeVisible();
    await expect(page.getByRole('link', { name: 'Users' })).toBeVisible();
    await expect(page.getByText(E2E_PLATFORM_ADMIN.email)).toBeVisible();
  });
});
