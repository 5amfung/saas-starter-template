import { expect, test } from '@playwright/test';
import {
  VALID_PASSWORD,
  createVerifiedUser,
  uniqueEmail,
} from '@workspace/test-utils';
import { parseCookieHeader } from '../lib/parse-cookie-header';

const WEB_SESSION_COOKIE = 'better-auth.session_token';
const ADMIN_SESSION_COOKIE = 'admin.session_token';

test.describe('Web cookie prefix', () => {
  test('web sessions use the Web session cookie name', async ({ baseURL }) => {
    const email = uniqueEmail('web-cookie-prefix');
    const { cookie } = await createVerifiedUser(baseURL!, {
      email,
      password: VALID_PASSWORD,
    });

    const cookieNames = parseCookieHeader(cookie).map(
      (parsedCookie) => parsedCookie.name
    );

    expect(cookieNames).toContain(WEB_SESSION_COOKIE);
    expect(cookieNames).not.toContain(ADMIN_SESSION_COOKIE);
  });
});
