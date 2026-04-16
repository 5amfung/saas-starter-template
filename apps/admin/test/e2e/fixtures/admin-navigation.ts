import { type Page, expect } from '@playwright/test';

export async function openAdminUserDetail(
  page: Page,
  userId: string
): Promise<void> {
  await page.goto(`/users/${userId}`);
  await page.waitForURL(new RegExp(`/users/${userId}$`));
  await expect(page.getByRole('textbox', { name: 'User ID' })).toHaveValue(
    userId
  );
}

export async function openAdminUserDetailByEmail(
  page: Page,
  email: string
): Promise<void> {
  await page.goto('/users');
  await expect(page.getByPlaceholder(/search/i)).toBeVisible();
  await page.getByPlaceholder(/search/i).fill(email);
  await page.keyboard.press('Enter');
  await page
    .getByRole('link', {
      name: email,
      exact: true,
    })
    .click();
  await page.waitForURL(/\/users\/.+$/);
  await expect(page.getByRole('textbox', { name: 'Full Name' })).toBeVisible();
}

export async function openAdminWorkspaceDetail(
  page: Page,
  workspaceId: string
): Promise<void> {
  await page.goto(`/workspaces/${workspaceId}`);
  await page.waitForURL(new RegExp(`/workspaces/${workspaceId}$`));
  await expect(page.getByText('Workspace Info')).toBeVisible();
}
