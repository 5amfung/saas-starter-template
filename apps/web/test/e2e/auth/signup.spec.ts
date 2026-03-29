import { expect, test } from '@playwright/test';
import {
  VALID_PASSWORD,
  getTestEmails,
  uniqueEmail,
} from '@workspace/test-utils';
import type { Page } from '@playwright/test';

/** Fills the sign-up form fields and submits. */
async function submitSignupForm(
  page: Page,
  email: string,
  password: string = VALID_PASSWORD
) {
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByLabel('Confirm Password').fill(password);
  await page.getByRole('button', { name: 'Create Account' }).click();
}

test.describe('Sign-up flow', () => {
  test('happy path: sign up, verify email, reach workspace', async ({
    page,
    baseURL,
  }) => {
    const email = uniqueEmail('signup');

    await page.goto('/signup');
    await expect(
      page.getByText('Create your account', { exact: true })
    ).toBeVisible();

    await submitSignupForm(page, email);

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

  test('duplicate email navigates to verify page', async ({ page }) => {
    const email = uniqueEmail('signup');

    // Sign up first time.
    await page.goto('/signup');
    await submitSignupForm(page, email);
    await expect(page).toHaveURL(/\/verify/);

    // Sign up second time with same email.
    await page.goto('/signup');
    await submitSignupForm(page, email);

    // Better Auth silently handles duplicate sign-ups by redirecting
    // to verify page (does not reveal whether the email exists).
    await expect(page).toHaveURL(/\/verify/);
  });

  test('weak password shows validation error', async ({ page }) => {
    await page.goto('/signup');
    await page.getByLabel('Email').fill(uniqueEmail('signup'));
    await page.getByLabel('Password', { exact: true }).fill('short');
    await page.getByLabel('Confirm Password').fill('short');
    await page.getByLabel('Password', { exact: true }).blur();

    await expect(page.getByRole('alert')).toContainText(
      'Password must be at least 8 characters'
    );
  });

  test('password mismatch shows validation error', async ({ page }) => {
    await page.goto('/signup');
    await page.getByLabel('Email').fill(uniqueEmail('signup'));
    await page.getByLabel('Password', { exact: true }).fill(VALID_PASSWORD);
    await page.getByLabel('Confirm Password').fill('DifferentPassword123!');
    await page.getByLabel('Confirm Password').blur();

    await expect(page.getByText('Passwords do not match')).toBeVisible();
  });

  test('resend verification email captures a second email', async ({
    page,
    baseURL,
  }) => {
    const email = uniqueEmail('signup');

    await page.goto('/signup');
    await submitSignupForm(page, email);
    await expect(page).toHaveURL(/\/verify/);

    // Wait for first email to be captured.
    const firstEmails = await getTestEmails(baseURL!, email);
    expect(firstEmails.length).toBeGreaterThanOrEqual(1);
    const firstCount = firstEmails.length;

    // Click resend.
    await page
      .getByRole('button', { name: 'Resend verification email' })
      .click();

    // Poll until a new email arrives.
    await expect
      .poll(
        async () => {
          const emails = await getTestEmails(baseURL!, email);
          return emails.length;
        },
        { timeout: 10000, intervals: [500] }
      )
      .toBeGreaterThan(firstCount);
  });

  test('invalid verification link does not reach workspace', async ({
    page,
  }) => {
    await page.goto(
      '/api/auth/verify-email?token=invalid-token-12345&callbackURL=/ws'
    );

    // Better Auth rejects the invalid token — user should NOT reach workspace.
    await expect(page).not.toHaveURL(/\/ws\/.*\/overview/, { timeout: 5000 });
  });
});
