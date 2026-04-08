import { expect, test } from '@playwright/test';
import {
  VALID_PASSWORD,
  createIsolatedWorkspaceFixture,
  createSeededUser,
  ensureWorkspaceSubscription,
  uniqueEmail,
  waitForTestEmail,
} from '@workspace/test-utils';
import { parseCookieHeader, toCookieHeader } from '../lib/parse-cookie-header';
import type { Page } from '@playwright/test';

/**
 * Creates a verified user and injects their session cookie into the browser
 * context so pages load as authenticated.
 */
async function signUpAndLogin(
  page: Page,
  baseURL: string,
  email: string = uniqueEmail()
): Promise<{ email: string; cookieHeader: string; workspaceId: string }> {
  const fixture = await createIsolatedWorkspaceFixture(baseURL, {
    owner: {
      email,
      password: VALID_PASSWORD,
    },
  });

  await page.context().addCookies(parseCookieHeader(fixture.owner.cookie));
  return {
    email: fixture.owner.email,
    cookieHeader: toCookieHeader(fixture.owner.cookie),
    workspaceId: fixture.workspace.id,
  };
}

/** Navigate to /ws, wait for redirect, extract workspaceId from URL. */
async function getActiveWorkspaceId(page: Page): Promise<string> {
  await page.goto('/ws', { waitUntil: 'domcontentloaded' });
  await page.waitForURL(/\/ws\/.+\/overview/, {
    timeout: 10000,
    waitUntil: 'domcontentloaded',
  });
  const match = page.url().match(/\/ws\/([^/]+)\/overview/);
  if (!match) throw new Error(`Cannot extract workspaceId from: ${page.url()}`);
  return match[1];
}

/** Navigate to the active workspace's settings page. */
async function goToSettings(page: Page, workspaceId?: string): Promise<string> {
  const activeWorkspaceId = workspaceId ?? (await getActiveWorkspaceId(page));
  await page.goto(`/ws/${activeWorkspaceId}/settings`, {
    waitUntil: 'domcontentloaded',
  });
  await page.waitForURL(`**/ws/${activeWorkspaceId}/settings`, {
    timeout: 10000,
    waitUntil: 'domcontentloaded',
  });
  return activeWorkspaceId;
}

/** Open the workspace switcher dropdown in the sidebar. */
async function openWorkspaceSwitcher(page: Page): Promise<void> {
  const trigger = page.locator('[data-sidebar="menu-button"]').first();
  await expect(trigger).toBeVisible({ timeout: 15000 });
  await trigger.click();
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
    { timeout: 15000, waitUntil: 'domcontentloaded' }
  );
}

async function getInvitationUrl(
  baseURL: string,
  to: string,
  maxRetries = 10
): Promise<string> {
  const email = await waitForTestEmail(
    baseURL,
    to,
    (candidate) =>
      candidate.subject.toLowerCase().includes('join') &&
      Boolean(candidate.invitationUrl),
    maxRetries
  );

  if (!email?.invitationUrl) {
    throw new Error(`No invitation URL captured for ${to}.`);
  }

  return email.invitationUrl;
}

function getInvitationId(invitationUrl: string): string {
  const id = new URL(invitationUrl).searchParams.get('id');
  if (!id) {
    throw new Error(`Invitation URL did not include an id: ${invitationUrl}`);
  }
  return id;
}

async function acceptInvitationViaApi(
  page: Page,
  baseURL: string,
  inviteeCredentials: { email: string; password: string },
  invitationId: string
): Promise<void> {
  const signinResponse = await page.request.post(
    `${baseURL}/api/auth/sign-in/email`,
    {
      headers: {
        'Content-Type': 'application/json',
        Origin: baseURL,
      },
      data: inviteeCredentials,
    }
  );

  if (!signinResponse.ok()) {
    throw new Error(`Invitee sign-in failed (${signinResponse.status()}).`);
  }

  const inviteeCookie = signinResponse
    .headers()
    ['set-cookie'].split(';')[0]
    .trim();

  const acceptResponse = await page.request.post(
    `${baseURL}/api/auth/organization/accept-invitation`,
    {
      headers: {
        'Content-Type': 'application/json',
        Cookie: inviteeCookie,
        Origin: baseURL,
      },
      data: { invitationId },
    }
  );

  if (!acceptResponse.ok()) {
    throw new Error(
      `Invitation acceptance failed (${acceptResponse.status()}).`
    );
  }
}

async function signIn(
  page: Page,
  credentials: {
    email: string;
    password: string;
  }
) {
  await page.goto('/signin');
  await page.getByLabel('Email').fill(credentials.email);
  await page.getByLabel('Password', { exact: true }).fill(credentials.password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await page.waitForURL(/\/ws\/.*\/overview/, {
    timeout: 15000,
    waitUntil: 'domcontentloaded',
  });
}

async function resetToSignedOutState(page: Page): Promise<void> {
  await page.evaluate(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });
  await page.context().clearCookies();
  await page.goto('/signin');
  await page.waitForURL(/\/signin(?:\?|$)/, { timeout: 15000 });
}

async function inviteWorkspaceUser(
  page: Page,
  baseURL: string,
  workspaceId: string,
  role: 'admin' | 'member'
): Promise<{ email: string; password: string }> {
  const inviteeEmail = uniqueEmail(`settings-${role}`);
  const inviteePassword = VALID_PASSWORD;

  await createSeededUser(baseURL, {
    email: inviteeEmail,
    password: inviteePassword,
  });

  await ensureWorkspaceSubscription(workspaceId, 'starter');

  await page.goto(`/ws/${workspaceId}/members`, {
    waitUntil: 'domcontentloaded',
  });
  await page.waitForURL(`**/ws/${workspaceId}/members`, {
    timeout: 15000,
    waitUntil: 'domcontentloaded',
  });
  await page.getByRole('button', { name: 'Invite', exact: true }).click();
  const alertdialog = page.getByRole('alertdialog');
  await expect(alertdialog).toBeVisible({ timeout: 10000 });

  const upgradeBtn = alertdialog.getByRole('button', { name: /upgrade to/i });
  if (await upgradeBtn.isVisible()) {
    await page.keyboard.press('Escape');
    await page.goto(`/ws/${workspaceId}/members`, {
      waitUntil: 'domcontentloaded',
    });
    await page.waitForURL(`**/ws/${workspaceId}/members`, {
      timeout: 15000,
      waitUntil: 'domcontentloaded',
    });
    await page.getByRole('button', { name: 'Invite', exact: true }).click();
  }

  await expect(page.getByText('Invite Member')).toBeVisible({ timeout: 5000 });
  await page.getByLabel('Email').fill(inviteeEmail);
  await page.getByRole('combobox').click();
  await page.getByRole('option', { name: role }).click();
  await page.getByRole('button', { name: 'Send Invitation' }).click();
  await expect(page.getByText('Invitation sent.').last()).toBeVisible({
    timeout: 10000,
  });

  const invitationUrl = await getInvitationUrl(baseURL, inviteeEmail);
  await acceptInvitationViaApi(
    page,
    baseURL,
    { email: inviteeEmail, password: inviteePassword },
    getInvitationId(invitationUrl)
  );

  return { email: inviteeEmail, password: inviteePassword };
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

  test('renaming a workspace updates the workspace switcher immediately', async ({
    page,
    baseURL,
  }) => {
    await signUpAndLogin(page, baseURL!);
    await goToSettings(page);

    const nameInput = page.getByLabel('Workspace Name');
    const newName = `Renamed WS ${Date.now()}`;

    await nameInput.fill(newName);
    await page.getByRole('button', { name: 'Save' }).click();

    await expect(page.getByText('Workspace updated.')).toBeVisible({
      timeout: 8000,
    });

    await expect(
      page.locator('[data-sidebar="menu-button"]').first()
    ).toContainText(newName);

    await openWorkspaceSwitcher(page);
    await expect(page.getByRole('menuitem', { name: newName })).toBeVisible();
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

  test('Delete Workspace disabled for last personal workspace', async ({
    page,
    baseURL,
  }) => {
    await signUpAndLogin(page, baseURL!);
    await goToSettings(page);

    await expect(
      page.getByRole('button', { name: 'Delete Workspace' })
    ).toBeDisabled();
    await expect(
      page.getByText('Cannot delete your last personal workspace.')
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

  test('workspace admin can view and update settings', async ({
    page,
    baseURL,
  }) => {
    test.setTimeout(120_000);

    const fixture = await createIsolatedWorkspaceFixture(baseURL!, {
      emailPrefix: 'settings-owner',
    });
    await signIn(page, fixture.owner);
    const workspaceId = fixture.workspace.id;
    const admin = await inviteWorkspaceUser(
      page,
      baseURL!,
      workspaceId,
      'admin'
    );

    await resetToSignedOutState(page);
    await signIn(page, admin);

    await expect(page.getByRole('link', { name: 'Settings' })).toBeVisible();
    await page.goto(`/ws/${workspaceId}/settings`, {
      waitUntil: 'domcontentloaded',
    });
    await page.waitForURL(`**/ws/${workspaceId}/settings`, {
      timeout: 10000,
      waitUntil: 'domcontentloaded',
    });

    const newName = `Admin Renamed ${Date.now()}`;
    await page.getByLabel('Workspace Name').fill(newName);
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByText('Workspace updated.')).toBeVisible({
      timeout: 8000,
    });
    await expect(page.getByLabel('Workspace Name')).toHaveValue(newName);
  });

  test('workspace member cannot access settings by URL', async ({
    page,
    baseURL,
  }) => {
    test.setTimeout(120_000);

    const fixture = await createIsolatedWorkspaceFixture(baseURL!, {
      emailPrefix: 'settings-member-owner',
    });
    await signIn(page, fixture.owner);
    const workspaceId = fixture.workspace.id;
    const member = await inviteWorkspaceUser(
      page,
      baseURL!,
      workspaceId,
      'member'
    );

    await resetToSignedOutState(page);
    await signIn(page, member);

    await expect(
      page.getByRole('link', { name: 'Settings' })
    ).not.toBeVisible();
    await page.goto(`/ws/${workspaceId}/settings`, {
      waitUntil: 'domcontentloaded',
    });
    await page.waitForLoadState('networkidle');
    await expect(page.getByRole('heading', { name: '404' })).toBeVisible({
      timeout: 15000,
    });
    await expect(
      page.getByText("The page you're looking for doesn't exist.")
    ).toBeVisible({ timeout: 15000 });
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
    await page.goto(`/ws/${firstId}/overview`, {
      waitUntil: 'domcontentloaded',
    });
    await page.waitForURL(`**/ws/${firstId}/overview`, {
      timeout: 10000,
      waitUntil: 'domcontentloaded',
    });

    // Switch to second workspace via dropdown.
    await openWorkspaceSwitcher(page);
    await page.getByRole('menuitem', { name: secondName }).click();
    await page.waitForURL(`**/ws/${secondId}/overview`, {
      timeout: 10000,
      waitUntil: 'domcontentloaded',
    });
    expect(page.url()).toContain(secondId);
  });

  test('delete non-last workspace', async ({ page, baseURL }) => {
    await signUpAndLogin(page, baseURL!);
    const firstId = await getActiveWorkspaceId(page);

    // Create a second workspace to delete.
    const deleteName = `To Delete ${Date.now()}`;
    await createWorkspaceViaSwitcher(page, deleteName);
    const secondId = page.url().match(/\/ws\/([^/]+)\/overview/)![1];

    // Go to its settings.
    await page.goto(`/ws/${secondId}/settings`, {
      waitUntil: 'domcontentloaded',
    });
    await page.waitForURL(`**/ws/${secondId}/settings`, {
      timeout: 10000,
      waitUntil: 'domcontentloaded',
    });

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

    await dialog.getByPlaceholder('DELETE').fill('DELETE');
    await expect(confirmBtn).toBeEnabled();
    await confirmBtn.click();

    // Redirected to remaining workspace.
    await page.waitForURL(/\/ws\/.+\/overview/, {
      timeout: 15000,
      waitUntil: 'domcontentloaded',
    });
    expect(page.url()).not.toContain(secondId);
    expect(page.url()).toContain(firstId);

    const workspaceTrigger = page
      .locator('[data-sidebar="menu-button"]')
      .first();
    await expect(workspaceTrigger).not.toContainText(deleteName);

    await openWorkspaceSwitcher(page);
    await expect(
      page.getByRole('menuitem', { name: deleteName })
    ).not.toBeVisible();
  });

  test('cancel delete dialog leaves workspace intact', async ({
    page,
    baseURL,
  }) => {
    await signUpAndLogin(page, baseURL!);
    await getActiveWorkspaceId(page);

    await createWorkspaceViaSwitcher(page, `Keep WS ${Date.now()}`);
    const wsId = page.url().match(/\/ws\/([^/]+)\/overview/)![1];

    await page.goto(`/ws/${wsId}/settings`, {
      waitUntil: 'domcontentloaded',
    });
    await page.waitForURL(`**/ws/${wsId}/settings`, {
      waitUntil: 'domcontentloaded',
    });

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
