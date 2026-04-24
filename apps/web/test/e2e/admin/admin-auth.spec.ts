import { expect, test } from '@playwright/test';

test('unauthenticated admin protected route redirects to shared signin with admin intent', async ({
  page,
}) => {
  await page.goto('/admin/dashboard');

  await expect(page).toHaveURL(/\/signin/);
  await expect(page).toHaveURL(/redirect=%2Fadmin%2Fdashboard/);
});
