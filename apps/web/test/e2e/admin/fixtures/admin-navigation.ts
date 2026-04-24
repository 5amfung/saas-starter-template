import { expect } from '@playwright/test';
import type { Page } from '@playwright/test';

export async function openAdminUserDetail(
  page: Page,
  userId: string
): Promise<void> {
  await page.goto(`/admin/users/${userId}`);
  await page.waitForURL(new RegExp(`/admin/users/${userId}$`));
  await expect(page.getByRole('textbox', { name: 'User ID' })).toHaveValue(
    userId
  );
}

export async function openAdminUserDetailByEmail(
  page: Page,
  email: string
): Promise<void> {
  await page.goto('/admin/users');
  await expect(page.getByPlaceholder(/search/i)).toBeVisible();
  await page.getByPlaceholder(/search/i).fill(email);
  await page.keyboard.press('Enter');
  await page
    .getByRole('link', {
      name: email,
      exact: true,
    })
    .click();
  await page.waitForURL(/\/admin\/users\/.+$/);
  await expect(page.getByRole('textbox', { name: 'Full Name' })).toBeVisible();
}

export async function openAdminWorkspaceDetail(
  page: Page,
  workspaceId: string
): Promise<void> {
  await page.goto(`/admin/workspaces/${workspaceId}`);
  await page.waitForURL(new RegExp(`/admin/workspaces/${workspaceId}$`));
  await expect(page.getByText('Workspace Info')).toBeVisible();
}
