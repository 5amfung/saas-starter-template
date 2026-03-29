import { expect, test } from '@playwright/test';
import {
  VALID_PASSWORD,
  createVerifiedUser,
  uniqueEmail,
} from '@workspace/test-utils';
import { parseCookieHeader } from '../lib/parse-cookie-header';

test.describe('Sign-in flow', () => {
  test('happy path: valid credentials redirect to workspace overview', async ({
    page,
    baseURL,
  }) => {
    const email = uniqueEmail();
    await createVerifiedUser(baseURL!, { email, password: VALID_PASSWORD });

    await page.goto('/signin');
    await expect(page.getByText('Welcome back')).toBeVisible();

    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password').fill(VALID_PASSWORD);
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();

    await page.waitForURL(/\/ws\/.+\/overview/, { timeout: 10000 });
    await expect(page.locator('body')).toBeVisible();
  });

  test('wrong password shows invalid credentials error', async ({
    page,
    baseURL,
  }) => {
    const email = uniqueEmail();
    await createVerifiedUser(baseURL!, { email, password: VALID_PASSWORD });

    await page.goto('/signin');
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password').fill('WrongPassword999!');
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();

    await expect(page.getByRole('alert')).toContainText(
      'Invalid email or password'
    );
    await expect(page).toHaveURL(/\/signin/);
  });

  test('non-existent email shows same error (no account enumeration)', async ({
    page,
  }) => {
    await page.goto('/signin');
    await page
      .getByLabel('Email')
      .fill(`ghost-${Date.now()}@nowhere.example.com`);
    await page.getByLabel('Password').fill(VALID_PASSWORD);
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();

    await expect(page.getByRole('alert')).toContainText(
      'Invalid email or password'
    );
    await expect(page).toHaveURL(/\/signin/);
  });

  test('empty fields show validation errors on blur', async ({ page }) => {
    await page.goto('/signin');

    // Focus then blur each field to trigger onBlur validation.
    await page.getByLabel('Email').focus();
    await page.getByLabel('Email').blur();
    await page.getByLabel('Password').focus();
    await page.getByLabel('Password').blur();

    await expect(
      page.getByText('Please enter a valid email address.')
    ).toBeVisible();
    await expect(page.getByText('Password is required.')).toBeVisible();
    await expect(page).toHaveURL(/\/signin/);
  });

  test('malformed email triggers inline error on blur', async ({ page }) => {
    await page.goto('/signin');
    await page.getByLabel('Email').fill('not-an-email');
    await page.getByLabel('Email').blur();

    await expect(
      page.getByText('Please enter a valid email address.')
    ).toBeVisible();
  });

  test('"Forgot your password?" link navigates to /forgot-password', async ({
    page,
  }) => {
    await page.goto('/signin');
    await page.getByRole('link', { name: 'Forgot your password?' }).click();

    await expect(page).toHaveURL(/\/forgot-password/);
  });

  test('"Sign up" link navigates to /signup', async ({ page }) => {
    await page.goto('/signin');
    await page.getByRole('link', { name: 'Sign up' }).click();

    await expect(page).toHaveURL(/\/signup/);
    await expect(
      page.getByText('Create your account', { exact: true })
    ).toBeVisible();
  });

  test('already-authenticated user visiting /signin redirected to /ws', async ({
    page,
    baseURL,
  }) => {
    const email = uniqueEmail();
    const { cookie } = await createVerifiedUser(baseURL!, {
      email,
      password: VALID_PASSWORD,
    });

    await page.context().addCookies(parseCookieHeader(cookie));
    await page.goto('/signin');

    // Guest middleware redirects authenticated users away from /signin.
    await page.waitForURL(/\/ws/, { timeout: 10000 });
    await expect(page).not.toHaveURL(/\/signin/);
  });

  test('unverified user redirected to /verify after sign-in', async ({
    page,
    baseURL,
  }) => {
    const email = uniqueEmail();

    // Sign up without verifying (raw API call, skip admin verification step).
    const signupResponse = await fetch(`${baseURL}/api/auth/sign-up/email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: baseURL!,
      },
      body: JSON.stringify({
        email,
        password: VALID_PASSWORD,
        name: 'Unverified User',
      }),
    });
    expect(signupResponse.ok).toBeTruthy();

    await page.goto('/signin');
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password').fill(VALID_PASSWORD);
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();

    await expect(page).toHaveURL(/\/verify/);
    await expect(page.getByText('Check your email')).toBeVisible();
    await expect(page.getByText(email)).toBeVisible();
  });

  test('sidebar shows correct user name and email after sign-in', async ({
    page,
    baseURL,
  }) => {
    const email = uniqueEmail();
    await createVerifiedUser(baseURL!, {
      email,
      password: VALID_PASSWORD,
      name: 'Sidebar Test',
    });

    await page.goto('/signin');
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password').fill(VALID_PASSWORD);
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();

    await page.waitForURL(/\/ws\/.+\/overview/, { timeout: 10000 });

    await expect(page.getByText('Sidebar Test')).toBeVisible();
    await expect(page.getByText(email)).toBeVisible();
  });

  test('Google sign-in button is present and enabled', async ({ page }) => {
    await page.goto('/signin');

    const googleButton = page.getByRole('button', {
      name: 'Sign in with Google',
    });
    await expect(googleButton).toBeVisible();
    await expect(googleButton).not.toBeDisabled();
  });

  test('OAuth error query param shows cancellation message', async ({
    page,
  }) => {
    await page.goto('/signin?error=oauth_cancelled');

    await expect(page.getByRole('alert')).toContainText(
      'Google sign-in was cancelled or failed'
    );
  });

  test('Terms of Service and Privacy Policy links are visible', async ({
    page,
  }) => {
    await page.goto('/signin');

    await expect(
      page.getByRole('link', { name: 'Terms of Service' })
    ).toBeVisible();
    await expect(
      page.getByRole('link', { name: 'Privacy Policy' })
    ).toBeVisible();
  });

  test('redirect query param honored after sign-in', async ({
    page,
    baseURL,
  }) => {
    const email = uniqueEmail();
    await createVerifiedUser(baseURL!, { email, password: VALID_PASSWORD });

    await page.goto('/signin?redirect=/account');
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password').fill(VALID_PASSWORD);
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();

    await expect(page).toHaveURL(/\/account/, { timeout: 10000 });
  });

  test('unsafe redirect param is rejected by search validation', async ({
    page,
  }) => {
    // safeRedirectSchema rejects URLs starting with "//" via its refine check.
    // TanStack Router fires a VALIDATE_SEARCH error, preventing the sign-in
    // form from rendering — the page hits the error boundary instead.
    await page.goto('/signin?redirect=//evil.example.com');

    // The sign-in form should NOT render with the malicious redirect.
    await expect(page.getByText('Welcome back')).not.toBeVisible({
      timeout: 3000,
    });

    // The browser stays on localhost — it never navigates to an external origin.
    const url = new URL(page.url());
    expect(url.origin).toBe('http://localhost:3000');
  });
});
