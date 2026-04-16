import { type Page, expect } from '@playwright/test';

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
}
