import { expect, test } from '@playwright/test';
import {
  VALID_PASSWORD,
  createVerifiedUser,
  uniqueEmail,
} from '@workspace/test-utils';
import type { Page } from '@playwright/test';

/**
 * Parses a raw Set-Cookie header into Playwright-compatible cookie objects.
 *
 * The header may contain multiple Set-Cookie values joined by ", " (the
 * standard way Node.js fetch combines them). A naive split on "," breaks when
 * cookie attributes include dates with commas (e.g., "Expires=Thu, 01 Jan ...").
 * To handle this safely we split on ", " only when the text after the comma
 * looks like a new cookie (i.e. contains "=" before any ";").
 */
function parseCookieHeader(raw: string): Array<{
  name: string;
  value: string;
  domain: string;
  path: string;
  httpOnly: boolean;
  secure: boolean;
  sameSite: 'Lax';
}> {
  // Split individual Set-Cookie strings by looking for ", <token>=" boundaries.
  const setCookies: Array<string> = [];
  let current = '';
  for (const segment of raw.split(', ')) {
    // A new cookie always starts with "name=value". If the segment before the
    // first ";" contains "=", it is a new cookie; otherwise it is a
    // continuation of an attribute (e.g., "01 Jan 2026 00:00:00 GMT; Path=/").
    const beforeSemicolon = segment.split(';')[0];
    if (current === '' || beforeSemicolon.includes('=')) {
      if (current) setCookies.push(current);
      current = segment;
    } else {
      current += ', ' + segment;
    }
  }
  if (current) setCookies.push(current);

  return setCookies.map((entry) => {
    const [nameValue] = entry.trim().split(';');
    const idx = nameValue.indexOf('=');
    return {
      name: nameValue.slice(0, idx).trim(),
      value: nameValue.slice(idx + 1).trim(),
      domain: 'localhost',
      path: '/',
      httpOnly: true,
      secure: false,
      sameSite: 'Lax' as const,
    };
  });
}

/**
 * Creates a verified user and injects their session cookie into the browser
 * context so pages load as authenticated.
 */
async function signUpAndLogin(
  page: Page,
  baseURL: string,
  email: string = uniqueEmail()
): Promise<{ email: string }> {
  const { cookie } = await createVerifiedUser(baseURL, {
    email,
    password: VALID_PASSWORD,
  });

  await page.context().addCookies(parseCookieHeader(cookie));
  return { email };
}

/** Navigate to /ws, wait for redirect, extract workspaceId from URL. */
async function getActiveWorkspaceId(page: Page): Promise<string> {
  await page.goto('/ws');
  await page.waitForURL(/\/ws\/.+\/overview/, { timeout: 10000 });
  const match = page.url().match(/\/ws\/([^/]+)\/overview/);
  if (!match) throw new Error(`Cannot extract workspaceId from: ${page.url()}`);
  return match[1];
}

/** Navigate to the active workspace's settings page. */
async function goToSettings(page: Page): Promise<string> {
  const workspaceId = await getActiveWorkspaceId(page);
  await page.goto(`/ws/${workspaceId}/settings`);
  await page.waitForURL(`**/ws/${workspaceId}/settings`, { timeout: 10000 });
  return workspaceId;
}

/** Open the workspace switcher dropdown in the sidebar. */
async function openWorkspaceSwitcher(page: Page): Promise<void> {
  await page.locator('[data-sidebar="menu-button"]').first().click();
}

/** Create a new workspace via the switcher "Add workspace" dialog. */
async function createWorkspaceViaSwitcher(
  page: Page,
  name: string
): Promise<void> {
  // Capture current URL so we can wait for the URL to actually change.
  const urlBeforeCreate = page.url();

  await openWorkspaceSwitcher(page);
  await page.getByText('Add workspace').click();
  await expect(page.getByRole('alertdialog')).toBeVisible();
  await page.getByPlaceholder('Workspace name').fill(name);
  await page.getByRole('button', { name: 'Create' }).click();

  // Wait for the dialog to close (mutation succeeded and navigated).
  await expect(page.getByRole('alertdialog')).not.toBeVisible({
    timeout: 15000,
  });

  // Wait for the URL to change to a *different* workspace overview page.
  await page.waitForURL(
    (url) =>
      /\/ws\/.+\/overview/.test(url.pathname) &&
      url.toString() !== urlBeforeCreate,
    { timeout: 15000 }
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Workspace Settings
// ═══════════════════════════════════════════════════════════════════════════

test.describe('Workspace Settings', () => {
  test('displays current workspace name', async ({ page, baseURL }) => {
    await signUpAndLogin(page, baseURL!);
    await goToSettings(page);

    // Target the card title specifically to avoid matching the sidebar "Workspace" label.
    await expect(
      page.locator('[data-slot="card-title"]', { hasText: 'Workspace' })
    ).toBeVisible();
    await expect(
      page.getByText('Manage workspace settings and metadata.')
    ).toBeVisible();

    const nameInput = page.getByLabel('Workspace Name');
    await expect(nameInput).toBeVisible();
    const value = await nameInput.inputValue();
    expect(value.length).toBeGreaterThan(0);
  });

  test('editing name enables Save and persists after reload', async ({
    page,
    baseURL,
  }) => {
    await signUpAndLogin(page, baseURL!);
    const workspaceId = await goToSettings(page);

    const nameInput = page.getByLabel('Workspace Name');
    const saveBtn = page.getByRole('button', { name: 'Save' });
    const cancelBtn = page.getByRole('button', { name: 'Cancel' });

    await expect(saveBtn).toBeDisabled();
    await expect(cancelBtn).toBeDisabled();

    const newName = `Renamed WS ${Date.now()}`;
    await nameInput.fill(newName);
    await expect(saveBtn).toBeEnabled();
    await expect(cancelBtn).toBeEnabled();

    await saveBtn.click();
    await expect(page.getByText('Workspace updated.')).toBeVisible({
      timeout: 8000,
    });
    await expect(saveBtn).toBeDisabled();

    // Persists after reload.
    await page.goto(`/ws/${workspaceId}/settings`);
    await expect(page.getByLabel('Workspace Name')).toHaveValue(newName);
  });

  test('Cancel resets name to saved value', async ({ page, baseURL }) => {
    await signUpAndLogin(page, baseURL!);
    await goToSettings(page);

    const nameInput = page.getByLabel('Workspace Name');
    const originalName = await nameInput.inputValue();

    await nameInput.fill('Unsaved Changes');
    await page.getByRole('button', { name: 'Cancel' }).click();

    await expect(nameInput).toHaveValue(originalName);
    await expect(page.getByRole('button', { name: 'Save' })).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Cancel' })).toBeDisabled();
  });

  test('empty name shows validation error', async ({ page, baseURL }) => {
    await signUpAndLogin(page, baseURL!);
    await goToSettings(page);

    const nameInput = page.getByLabel('Workspace Name');
    await nameInput.fill('');
    await nameInput.blur();

    await expect(page.getByText('Workspace name is required.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Save' })).toBeDisabled();
  });

  test('Delete Workspace disabled for last workspace', async ({
    page,
    baseURL,
  }) => {
    await signUpAndLogin(page, baseURL!);
    await goToSettings(page);

    await expect(
      page.getByRole('button', { name: 'Delete Workspace' })
    ).toBeDisabled();
    await expect(
      page.getByText('Cannot delete your last workspace.')
    ).toBeVisible();
  });

  test('Danger Zone section visible', async ({ page, baseURL }) => {
    await signUpAndLogin(page, baseURL!);
    await goToSettings(page);

    await expect(
      page.getByRole('heading', { name: 'Danger Zone' })
    ).toBeVisible();
    await expect(
      page.getByText(
        'Permanently delete this workspace and all associated data.'
      )
    ).toBeVisible();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Workspace Switching & Creation
// ═══════════════════════════════════════════════════════════════════════════

test.describe('Workspace Switching & Creation', () => {
  test('workspace switcher shows active workspace', async ({
    page,
    baseURL,
  }) => {
    await signUpAndLogin(page, baseURL!);
    await getActiveWorkspaceId(page);

    await openWorkspaceSwitcher(page);
    await expect(page.getByText('Workspaces')).toBeVisible();
    await expect(page.getByText('Add workspace')).toBeVisible();
    await page.keyboard.press('Escape');
  });

  test('create new workspace via Add workspace', async ({ page, baseURL }) => {
    await signUpAndLogin(page, baseURL!);
    await getActiveWorkspaceId(page);

    const newName = `E2E Workspace ${Date.now()}`;
    await createWorkspaceViaSwitcher(page, newName);

    // Sidebar should show the new workspace name.
    await expect(
      page.locator('[data-sidebar="menu-button"]').first()
    ).toContainText(newName, { timeout: 8000 });
  });

  test('active workspace changes after creation', async ({ page, baseURL }) => {
    await signUpAndLogin(page, baseURL!);
    const originalId = await getActiveWorkspaceId(page);

    await createWorkspaceViaSwitcher(page, `New WS ${Date.now()}`);

    const newMatch = page.url().match(/\/ws\/([^/]+)\/overview/);
    expect(newMatch).toBeTruthy();
    expect(newMatch![1]).not.toBe(originalId);
  });

  test('switch between workspaces', async ({ page, baseURL }) => {
    await signUpAndLogin(page, baseURL!);
    const firstId = await getActiveWorkspaceId(page);

    const secondName = `Second WS ${Date.now()}`;
    await createWorkspaceViaSwitcher(page, secondName);
    const secondId = page.url().match(/\/ws\/([^/]+)\/overview/)![1];

    // Switch back to first workspace via direct navigation.
    await page.goto(`/ws/${firstId}/overview`);
    await page.waitForURL(`**/ws/${firstId}/overview`, { timeout: 10000 });

    // Switch to second workspace via dropdown.
    await openWorkspaceSwitcher(page);
    await page.getByRole('menuitem', { name: secondName }).click();
    await page.waitForURL(`**/ws/${secondId}/overview`, { timeout: 10000 });
    expect(page.url()).toContain(secondId);
  });

  test('delete non-last workspace', async ({ page, baseURL }) => {
    await signUpAndLogin(page, baseURL!);
    await getActiveWorkspaceId(page);

    // Create a second workspace to delete.
    const deleteName = `To Delete ${Date.now()}`;
    await createWorkspaceViaSwitcher(page, deleteName);
    const secondId = page.url().match(/\/ws\/([^/]+)\/overview/)![1];

    // Go to its settings.
    await page.goto(`/ws/${secondId}/settings`);
    await page.waitForURL(`**/ws/${secondId}/settings`, { timeout: 10000 });

    const deleteBtn = page.getByRole('button', { name: 'Delete Workspace' });
    await expect(deleteBtn).toBeEnabled();
    await deleteBtn.click();

    // Confirmation dialog.
    const dialog = page.getByRole('alertdialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText('Delete Workspace')).toBeVisible();

    // Confirm button disabled until "DELETE" typed.
    const confirmBtn = dialog.getByRole('button', { name: 'Confirm delete' });
    await expect(confirmBtn).toBeDisabled();

    await page.locator('#workspace-delete-confirm').fill('DELETE');
    await expect(confirmBtn).toBeEnabled();
    await confirmBtn.click();

    // Redirected to remaining workspace.
    await page.waitForURL(/\/ws\/.+\/overview/, { timeout: 15000 });
    expect(page.url()).not.toContain(secondId);

    await expect(page.getByText('Workspace deleted successfully.')).toBeVisible(
      { timeout: 8000 }
    );
  });

  test('cancel delete dialog leaves workspace intact', async ({
    page,
    baseURL,
  }) => {
    await signUpAndLogin(page, baseURL!);
    await getActiveWorkspaceId(page);

    await createWorkspaceViaSwitcher(page, `Keep WS ${Date.now()}`);
    const wsId = page.url().match(/\/ws\/([^/]+)\/overview/)![1];

    await page.goto(`/ws/${wsId}/settings`);
    await page.waitForURL(`**/ws/${wsId}/settings`);

    await page.getByRole('button', { name: 'Delete Workspace' }).click();
    await expect(page.getByRole('alertdialog')).toBeVisible();

    await page
      .getByRole('alertdialog')
      .getByRole('button', { name: 'Cancel' })
      .click();

    await expect(page.getByRole('alertdialog')).not.toBeVisible();
    await expect(page).toHaveURL(`/ws/${wsId}/settings`);
  });

  test('Add workspace rejects empty name', async ({ page, baseURL }) => {
    await signUpAndLogin(page, baseURL!);
    await getActiveWorkspaceId(page);

    await openWorkspaceSwitcher(page);
    await page.getByText('Add workspace').click();
    await expect(page.getByRole('alertdialog')).toBeVisible();

    // Create button disabled with empty input.
    const createBtn = page.getByRole('button', { name: 'Create' });
    await expect(createBtn).toBeDisabled();

    // Whitespace-only also keeps the button disabled (trim().length === 0).
    await page.getByPlaceholder('Workspace name').fill('   ');
    await expect(createBtn).toBeDisabled();
    await expect(page.getByRole('alertdialog')).toBeVisible();
  });

  test('Add workspace rejects invalid characters', async ({
    page,
    baseURL,
  }) => {
    await signUpAndLogin(page, baseURL!);
    await getActiveWorkspaceId(page);

    await openWorkspaceSwitcher(page);
    await page.getByText('Add workspace').click();

    await page.getByPlaceholder('Workspace name').fill('Invalid!@#$%');
    await page.getByRole('button', { name: 'Create' }).click();

    await expect(page.getByRole('alert')).toContainText(
      'Only letters, numbers, spaces, -, and _ are allowed.'
    );
  });

  test('dismiss Add workspace dialog without creating', async ({
    page,
    baseURL,
  }) => {
    await signUpAndLogin(page, baseURL!);
    await getActiveWorkspaceId(page);

    await openWorkspaceSwitcher(page);
    await page.getByText('Add workspace').click();
    await expect(page.getByRole('alertdialog')).toBeVisible();

    await page.getByPlaceholder('Workspace name').fill('Should Not Create');
    await page
      .getByRole('alertdialog')
      .getByRole('button', { name: 'Cancel' })
      .click();

    await expect(page.getByRole('alertdialog')).not.toBeVisible();
    await expect(page).toHaveURL(/\/overview$/);
  });
});
