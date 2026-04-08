import { expect, test } from '@playwright/test';
import { VALID_PASSWORD, uniqueEmail } from '@workspace/test-utils';
import {
  createVerifiedAdminCandidate,
  drain,
  promoteUserToAdmin,
} from '../lib/auth-helpers';
import { parseCookieHeader } from '../lib/parse-cookie-header';

const ADMIN_SESSION_COOKIE = 'admin.session_token';

test.describe('Admin cookie prefix', () => {
  test('admin sessions use the Admin session cookie name', async ({
    browser,
    baseURL,
  }) => {
    const adminBaseURL = baseURL ?? 'http://localhost:3001';
    const email = uniqueEmail('admin-cookie-prefix');
    const password = VALID_PASSWORD;

    const { userId } = await createVerifiedAdminCandidate({
      baseUrl: adminBaseURL,
      email,
      password,
    });

    await promoteUserToAdmin(userId);

    const adminSigninResponse = await fetch(
      `${adminBaseURL}/api/auth/sign-in/email`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Origin: adminBaseURL,
        },
        body: JSON.stringify({ email, password }),
      }
    );

    expect(adminSigninResponse.ok).toBe(true);

    const adminCookie = adminSigninResponse.headers.get('set-cookie') ?? '';
    await drain(adminSigninResponse);

    const adminCookies = parseCookieHeader(adminCookie);
    const adminCookieNames = adminCookies.map(
      (parsedCookie) => parsedCookie.name
    );
    expect(adminCookieNames).toContain(ADMIN_SESSION_COOKIE);

    const context = await browser.newContext();
    try {
      await context.addCookies(adminCookies);

      const contextCookieNames = (await context.cookies()).map(
        (cookie) => cookie.name
      );
      expect(contextCookieNames).toContain(ADMIN_SESSION_COOKIE);

      const page = await context.newPage();
      await page.goto(`${adminBaseURL}/dashboard`);
      await expect(page).toHaveURL(/\/dashboard(?:\?|$)/);
      await expect(page.getByRole('link', { name: 'Dashboard' })).toBeVisible();
    } finally {
      await context.close();
    }
  });
});
