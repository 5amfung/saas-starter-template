import { expect, test } from '@playwright/test';
import {
  VALID_PASSWORD,
  createSeededUser,
  uniqueEmail,
} from '@workspace/test-utils';
import { parseCookieHeader } from '../lib/parse-cookie-header';
import type { Page } from '@playwright/test';

/**
 * Creates a verified user and injects their session cookie into the browser
 * context so pages load as authenticated without driving the sign-in UI.
 */
async function loginWithCookie(
  page: Page,
  baseURL: string,
  opts: { email?: string; password?: string; name?: string } = {}
) {
  const email = opts.email ?? uniqueEmail();
  const password = opts.password ?? VALID_PASSWORD;
  const { cookie } = await createSeededUser(baseURL, {
    email,
    password,
    name: opts.name,
  });

  await page.context().addCookies(parseCookieHeader(cookie));
  return { email, password };
}

// ═══════════════════════════════════════════════════════════════════════════
// Profile
// ═══════════════════════════════════════════════════════════════════════════

test.describe('Account — Profile', () => {
  test('displays user profile info correctly', async ({ page, baseURL }) => {
    await loginWithCookie(page, baseURL!, {
      name: 'Profile User',
    });

    await page.goto('/account');
    await expect(page.getByText('Profile', { exact: true })).toBeVisible();
    await expect(
      page.getByText('Manage your profile information.')
    ).toBeVisible();

    const nameInput = page.getByLabel('Full Name');
    await expect(nameInput).toBeVisible();
    await expect(nameInput).toHaveValue('Profile User');

    // Save/Cancel disabled on initial load.
    await expect(
      page.getByRole('button', { name: 'Save Changes' })
    ).toBeDisabled();
    await expect(
      page.getByRole('button', { name: 'Cancel' }).first()
    ).toBeDisabled();
  });

  test('update full name persists after reload', async ({ page, baseURL }) => {
    await loginWithCookie(page, baseURL!, { name: 'Old Name' });
    await page.goto('/account');

    const nameInput = page.getByLabel('Full Name');
    const saveBtn = page.getByRole('button', { name: 'Save Changes' });

    await nameInput.fill('New Name');
    await expect(saveBtn).toBeEnabled();
    await saveBtn.click();

    await expect(page.getByText('Profile updated.')).toBeVisible();
    await expect(saveBtn).toBeDisabled();

    await page.reload();
    await expect(page.getByLabel('Full Name')).toHaveValue('New Name');
  });

  test('Cancel resets unsaved name change', async ({ page, baseURL }) => {
    await loginWithCookie(page, baseURL!, { name: 'Original' });
    await page.goto('/account');

    const nameInput = page.getByLabel('Full Name');
    await nameInput.fill('Changed');

    const cancelBtn = page.getByRole('button', { name: 'Cancel' }).first();
    await expect(cancelBtn).toBeEnabled();
    await cancelBtn.click();

    await expect(nameInput).toHaveValue('Original');
    await expect(cancelBtn).toBeDisabled();
    await expect(
      page.getByRole('button', { name: 'Save Changes' })
    ).toBeDisabled();
  });

  test('empty name shows validation error', async ({ page, baseURL }) => {
    await loginWithCookie(page, baseURL!, { name: 'Has Name' });
    await page.goto('/account');

    const nameInput = page.getByLabel('Full Name');
    await nameInput.fill('');
    await nameInput.blur();

    await expect(page.getByText('Name is required.')).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Save Changes' })
    ).toBeDisabled();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Email
// ═══════════════════════════════════════════════════════════════════════════

test.describe('Account — Email', () => {
  test('Change Email dialog opens with correct structure', async ({
    page,
    baseURL,
  }) => {
    const { email } = await loginWithCookie(page, baseURL!);
    await page.goto('/account');

    // Email field is read-only, showing current email.
    await expect(page.locator('#account-email')).toHaveValue(email);

    await page.getByRole('button', { name: 'Change Email' }).first().click();

    const dialog = page.getByRole('alertdialog');
    await expect(dialog).toBeVisible();
    await expect(
      dialog.getByRole('heading', { name: 'Change Email' })
    ).toBeVisible();

    await expect(page.locator('#new-email')).toBeVisible();
    await expect(page.locator('#change-confirm')).toBeVisible();

    // Action button disabled until conditions met.
    await expect(
      dialog.getByRole('button', { name: 'Change Email' })
    ).toBeDisabled();
  });

  test('CHANGE confirmation required to enable submit', async ({
    page,
    baseURL,
  }) => {
    await loginWithCookie(page, baseURL!);
    await page.goto('/account');
    await page.getByRole('button', { name: 'Change Email' }).first().click();

    const dialog = page.getByRole('alertdialog');
    const actionBtn = dialog.getByRole('button', { name: 'Change Email' });

    await page.locator('#new-email').fill('new@example.com');
    await page.locator('#change-confirm').fill('change'); // lowercase
    await expect(actionBtn).toBeDisabled();

    await page.locator('#change-confirm').fill('CHANGE'); // exact match
    await expect(actionBtn).toBeEnabled();
  });

  test('same email as current is rejected', async ({ page, baseURL }) => {
    const { email } = await loginWithCookie(page, baseURL!);
    await page.goto('/account');
    await page.getByRole('button', { name: 'Change Email' }).first().click();

    await page.locator('#new-email').fill(email);
    await page.locator('#change-confirm').fill('CHANGE');

    await expect(
      page.getByText('New email must differ from current.')
    ).toBeVisible();
  });

  test('invalid email format rejected', async ({ page, baseURL }) => {
    await loginWithCookie(page, baseURL!);
    await page.goto('/account');
    await page.getByRole('button', { name: 'Change Email' }).first().click();

    await page.locator('#new-email').fill('not-an-email');
    await page.locator('#new-email').blur();

    await expect(
      page.getByText('Please enter a valid email address.')
    ).toBeVisible();
  });

  test('successful email change shows confirmation toast', async ({
    page,
    baseURL,
  }) => {
    const { email } = await loginWithCookie(page, baseURL!);
    await page.goto('/account');
    await page.getByRole('button', { name: 'Change Email' }).first().click();

    await page.locator('#new-email').fill('brand-new@example.com');
    await page.locator('#change-confirm').fill('CHANGE');

    const dialog = page.getByRole('alertdialog');
    await dialog.getByRole('button', { name: 'Change Email' }).click();

    await expect(
      page.getByText('Check your current email to approve this change.')
    ).toBeVisible();

    // Dialog closes, original email still shown.
    await expect(dialog).not.toBeVisible();
    await expect(page.locator('#account-email')).toHaveValue(email);
  });

  test('Cancel clears dialog fields on reopen', async ({ page, baseURL }) => {
    await loginWithCookie(page, baseURL!);
    await page.goto('/account');
    await page.getByRole('button', { name: 'Change Email' }).first().click();

    await page.locator('#new-email').fill('partial@example.com');
    await page.locator('#change-confirm').fill('CHA');
    await page
      .getByRole('alertdialog')
      .getByRole('button', { name: 'Cancel' })
      .click();

    await expect(page.getByRole('alertdialog')).not.toBeVisible();

    // Reopen — fields should be empty.
    await page.getByRole('button', { name: 'Change Email' }).first().click();
    await expect(page.locator('#new-email')).toHaveValue('');
    await expect(page.locator('#change-confirm')).toHaveValue('');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Password
// ═══════════════════════════════════════════════════════════════════════════

test.describe('Account — Password', () => {
  test('Change Password dialog opens with correct fields', async ({
    page,
    baseURL,
  }) => {
    await loginWithCookie(page, baseURL!);
    await page.goto('/account');

    await page.getByRole('button', { name: 'Change Password' }).first().click();

    const dialog = page.getByRole('alertdialog');
    await expect(dialog).toBeVisible();
    await expect(
      dialog.getByRole('heading', { name: 'Change Password' })
    ).toBeVisible();

    await expect(page.locator('#currentPassword')).toBeVisible();
    await expect(page.locator('#newPassword')).toBeVisible();
    await expect(page.locator('#confirmPassword')).toBeVisible();

    await expect(
      dialog.getByRole('button', { name: 'Change Password' })
    ).toBeVisible();
  });

  test('empty current password shows error on blur', async ({
    page,
    baseURL,
  }) => {
    await loginWithCookie(page, baseURL!);
    await page.goto('/account');
    await page.getByRole('button', { name: 'Change Password' }).first().click();

    await page.locator('#currentPassword').fill('x');
    await page.locator('#currentPassword').fill('');
    await page.locator('#currentPassword').blur();

    await expect(page.getByText('Current password is required.')).toBeVisible();
  });

  test('short new password shows validation error', async ({
    page,
    baseURL,
  }) => {
    await loginWithCookie(page, baseURL!);
    await page.goto('/account');
    await page.getByRole('button', { name: 'Change Password' }).first().click();

    await page.locator('#newPassword').fill('short');
    await page.locator('#newPassword').blur();

    await expect(
      page.getByText('Password must be at least 8 characters.')
    ).toBeVisible();
  });

  test('password mismatch shows error', async ({ page, baseURL }) => {
    await loginWithCookie(page, baseURL!);
    await page.goto('/account');
    await page.getByRole('button', { name: 'Change Password' }).first().click();

    await page.locator('#newPassword').fill('NewPassword1!');
    await page.locator('#confirmPassword').fill('Different1!');
    await page.locator('#confirmPassword').blur();

    await expect(page.getByText('Passwords do not match.')).toBeVisible();
  });

  test('successful password change shows toast', async ({ page, baseURL }) => {
    const password = 'OldPassword1!';
    await loginWithCookie(page, baseURL!, { password });
    await page.goto('/account');
    await page.getByRole('button', { name: 'Change Password' }).first().click();

    await page.locator('#currentPassword').fill(password);
    await page.locator('#newPassword').fill('NewPassword2!');
    await page.locator('#confirmPassword').fill('NewPassword2!');
    await page.locator('#confirmPassword').blur();

    const dialog = page.getByRole('alertdialog');
    await dialog.getByRole('button', { name: 'Change Password' }).click();

    await expect(page.getByText('Password updated.')).toBeVisible({
      timeout: 10000,
    });
    await expect(dialog).not.toBeVisible();
  });

  test('wrong current password shows error', async ({ page, baseURL }) => {
    await loginWithCookie(page, baseURL!);
    await page.goto('/account');
    await page.getByRole('button', { name: 'Change Password' }).first().click();

    await page.locator('#currentPassword').fill('WrongPassword!');
    await page.locator('#newPassword').fill('NewPassword2!');
    await page.locator('#confirmPassword').fill('NewPassword2!');
    await page.locator('#confirmPassword').blur();

    const dialog = page.getByRole('alertdialog');
    await dialog.getByRole('button', { name: 'Change Password' }).click();

    // API error toast appears; dialog stays open.
    await expect(page.getByRole('alertdialog')).toBeVisible();
  });

  test('Cancel resets password dialog fields', async ({ page, baseURL }) => {
    await loginWithCookie(page, baseURL!);
    await page.goto('/account');
    // Dismiss vite error overlay if a transient server error caused it.
    // Use CSS to hide and disable pointer events — more robust than removing
    // the element since Vite can re-inject it.
    await page.addStyleTag({
      content: 'vite-error-overlay { display: none !important; }',
    });
    await page.getByRole('button', { name: 'Change Password' }).first().click();

    await page.locator('#currentPassword').fill('something');
    await page.locator('#newPassword').fill('NewPass123!');
    await page.locator('#confirmPassword').fill('NewPass123!');

    await page
      .getByRole('alertdialog')
      .getByRole('button', { name: 'Cancel' })
      .click();

    await expect(page.getByRole('alertdialog')).not.toBeVisible();

    // Reopen — fields should be empty.
    await page.getByRole('button', { name: 'Change Password' }).first().click();
    await expect(page.locator('#currentPassword')).toHaveValue('');
    await expect(page.locator('#newPassword')).toHaveValue('');
    await expect(page.locator('#confirmPassword')).toHaveValue('');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Active Sessions
// ═══════════════════════════════════════════════════════════════════════════

test.describe('Account — Sessions', () => {
  test('current session shows "This device" badge without Revoke', async ({
    page,
    baseURL,
  }) => {
    await loginWithCookie(page, baseURL!);
    await page.goto('/account');

    await expect(
      page.getByText('Active sessions', { exact: true })
    ).toBeVisible();
    await expect(page.getByText('This device', { exact: true })).toBeVisible();

    // The session row containing "This device" should NOT have a Revoke button.
    // Target the specific session card (rounded-lg border) rather than any ancestor div.
    const thisDeviceRow = page
      .locator('div.rounded-lg.border')
      .filter({ has: page.getByText('This device', { exact: true }) });
    await expect(
      thisDeviceRow.getByRole('button', { name: 'Revoke' })
    ).not.toBeVisible();
  });

  test('revoke non-current session removes it', async ({ page, baseURL }) => {
    const { email, password } = await loginWithCookie(page, baseURL!);

    // Create a second session via API sign-in.
    const response = await fetch(`${baseURL}/api/auth/sign-in/email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: baseURL!,
      },
      body: JSON.stringify({ email, password }),
    });
    expect(response.ok).toBe(true);

    await page.goto('/account');

    // Wait for the sessions list to load and show a Revoke button for
    // the non-current session. Use expect() so Playwright auto-retries
    // while TanStack Query fetches the session data.
    const revokeBtn = page.getByRole('button', { name: 'Revoke' }).first();
    await expect(revokeBtn).toBeVisible({ timeout: 10000 });

    await revokeBtn.click();

    // Confirmation dialog.
    await expect(page.getByText('Revoke session?')).toBeVisible();
    await page.getByRole('button', { name: 'Revoke session' }).click();

    await expect(page.getByText('Session revoked.')).toBeVisible();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Connected Accounts
// ═══════════════════════════════════════════════════════════════════════════

test.describe('Account — Connected Accounts', () => {
  test('shows Google with Connect button for password-only user', async ({
    page,
    baseURL,
  }) => {
    await loginWithCookie(page, baseURL!);
    await page.goto('/account');

    await expect(page.getByText('Connected accounts')).toBeVisible();
    await expect(page.getByText('Google')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Connect' })).toBeVisible();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Notifications
// ═══════════════════════════════════════════════════════════════════════════

test.describe('Notifications', () => {
  test('displays both toggles with correct initial states', async ({
    page,
    baseURL,
  }) => {
    await loginWithCookie(page, baseURL!);
    await page.goto('/notifications');

    // Email updates — always on, disabled.
    const emailToggle = page.getByLabel(
      'Email updates is enabled and cannot be changed'
    );
    await expect(emailToggle).toBeVisible();
    await expect(emailToggle).toBeChecked();
    await expect(emailToggle).toBeDisabled();

    // Marketing emails — interactive.
    const marketingToggle = page.getByLabel('Toggle marketing emails');
    await expect(marketingToggle).toBeVisible();
    await expect(marketingToggle).toBeEnabled();
  });

  test('marketing emails toggle can be enabled and persists', async ({
    page,
    baseURL,
  }) => {
    await loginWithCookie(page, baseURL!);
    await page.goto('/notifications');

    const toggle = page.getByLabel('Toggle marketing emails');

    // If already checked, uncheck first to establish baseline.
    if (await toggle.isChecked()) {
      await toggle.click();
      await expect(
        page.getByText('Notification preferences updated.')
      ).toBeVisible();
    }

    // Enable marketing emails.
    await toggle.click();
    await expect(
      page.getByText('Notification preferences updated.')
    ).toBeVisible();
    await expect(toggle).toBeChecked();

    // Persists after reload.
    await page.reload();
    await expect(page.getByLabel('Toggle marketing emails')).toBeChecked();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Auth Redirect Guards
// ═══════════════════════════════════════════════════════════════════════════

test.describe('Account — Auth Guards', () => {
  test('unauthenticated user redirected from /account', async ({ page }) => {
    await page.goto('/account');
    await expect(page).toHaveURL(/\/signin/, { timeout: 10000 });
  });

  test('unauthenticated user redirected from /notifications', async ({
    page,
  }) => {
    await page.goto('/notifications');
    await expect(page).toHaveURL(/\/signin/, { timeout: 10000 });
  });
});
