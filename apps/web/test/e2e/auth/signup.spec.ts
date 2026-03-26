import { expect, test } from '@playwright/test';

/** Generate a unique email for each test to avoid parallel collisions. */
function uniqueEmail(): string {
  return `test-signup-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@example.com`;
}

const VALID_PASSWORD = 'TestPassword123!';

/**
 * Fetches captured emails from the test-only API route.
 * Retries up to maxRetries times with a delay, since the email
 * may not be captured instantly after form submission.
 */
async function getTestEmails(
  baseURL: string,
  to: string,
  maxRetries = 5
): Promise<
  Array<{
    to: string;
    subject: string;
    verificationUrl: string | null;
    sentAt: string;
  }>
> {
  for (let i = 0; i < maxRetries; i++) {
    const response = await fetch(
      `${baseURL}/api/test/emails?to=${encodeURIComponent(to)}`
    );
    const data = (await response.json()) as {
      emails: Array<{
        to: string;
        subject: string;
        verificationUrl: string | null;
        sentAt: string;
      }>;
    };
    if (data.emails.length > 0) return data.emails;
    await new Promise((r) => setTimeout(r, 500));
  }
  return [];
}

test.describe('Sign-up flow', () => {
  test('happy path: sign up, verify email, reach workspace', async ({
    page,
    baseURL,
  }) => {
    const email = uniqueEmail();

    // Navigate to sign-up page.
    await page.goto('/signup');
    await expect(
      page.getByRole('heading', { name: 'Create your account' })
    ).toBeVisible();

    // Fill out the form.
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password', { exact: true }).fill(VALID_PASSWORD);
    await page.getByLabel('Confirm Password').fill(VALID_PASSWORD);
    await page.getByRole('button', { name: 'Create Account' }).click();

    // Should navigate to verify page.
    await expect(page).toHaveURL(/\/verify/);
    await expect(page.getByText('Check your email')).toBeVisible();
    await expect(page.getByText(email)).toBeVisible();

    // Fetch the verification URL from the test email API.
    const emails = await getTestEmails(baseURL!, email);
    expect(emails).toHaveLength(1);
    expect(emails[0].subject).toBe('Verify your email address');
    expect(emails[0].verificationUrl).toBeTruthy();

    // Visit the verification URL.
    await page.goto(emails[0].verificationUrl!);

    // Should auto-sign in and redirect to workspace.
    await page.waitForURL(/\/ws\/.*\/overview/, { timeout: 10000 });
    await expect(page.locator('body')).toBeVisible();
  });

  test('duplicate email shows error', async ({ page }) => {
    const email = uniqueEmail();

    // Sign up first time.
    await page.goto('/signup');
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password', { exact: true }).fill(VALID_PASSWORD);
    await page.getByLabel('Confirm Password').fill(VALID_PASSWORD);
    await page.getByRole('button', { name: 'Create Account' }).click();
    await expect(page).toHaveURL(/\/verify/);

    // Sign up second time with same email.
    await page.goto('/signup');
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password', { exact: true }).fill(VALID_PASSWORD);
    await page.getByLabel('Confirm Password').fill(VALID_PASSWORD);
    await page.getByRole('button', { name: 'Create Account' }).click();

    // Should show duplicate error.
    await expect(
      page.getByText('An account with this email already exists')
    ).toBeVisible();
  });

  test('weak password shows validation error', async ({ page }) => {
    await page.goto('/signup');
    await page.getByLabel('Email').fill(uniqueEmail());
    await page.getByLabel('Password', { exact: true }).fill('short');
    await page.getByLabel('Confirm Password').fill('short');
    await page.getByLabel('Password', { exact: true }).blur();

    // Should show password length error.
    await expect(page.getByText(/at least 8 characters/i)).toBeVisible();
  });

  test('password mismatch shows validation error', async ({ page }) => {
    await page.goto('/signup');
    await page.getByLabel('Email').fill(uniqueEmail());
    await page.getByLabel('Password', { exact: true }).fill(VALID_PASSWORD);
    await page.getByLabel('Confirm Password').fill('DifferentPassword123!');
    await page.getByLabel('Confirm Password').blur();

    // Should show mismatch error.
    await expect(page.getByText('Passwords do not match')).toBeVisible();
  });

  test('resend verification email captures a second email', async ({
    page,
    baseURL,
  }) => {
    const email = uniqueEmail();

    // Sign up.
    await page.goto('/signup');
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password', { exact: true }).fill(VALID_PASSWORD);
    await page.getByLabel('Confirm Password').fill(VALID_PASSWORD);
    await page.getByRole('button', { name: 'Create Account' }).click();
    await expect(page).toHaveURL(/\/verify/);

    // Wait for first email to be captured.
    let emails = await getTestEmails(baseURL!, email);
    expect(emails.length).toBeGreaterThanOrEqual(1);
    const firstCount = emails.length;

    // Click resend.
    await page
      .getByRole('button', { name: 'Resend verification email' })
      .click();

    // Wait for a second email to appear.
    const maxWait = 10;
    for (let i = 0; i < maxWait; i++) {
      emails = await getTestEmails(baseURL!, email);
      if (emails.length > firstCount) break;
      await new Promise((r) => setTimeout(r, 500));
    }

    expect(emails.length).toBeGreaterThan(firstCount);
  });

  test('invalid verification link shows error or redirects', async ({
    page,
  }) => {
    // Visit a malformed verification URL.
    await page.goto(
      '/api/auth/verify-email?token=invalid-token-12345&callbackURL=/ws'
    );

    // Better Auth should reject the invalid token.
    // The exact behavior depends on Better Auth's error handling —
    // it may redirect to an error page or show an error message.
    // We just verify the user does NOT end up on the workspace dashboard.
    await page.waitForLoadState('networkidle');
    expect(page.url()).not.toMatch(/\/ws\/.*\/overview/);
  });
});
