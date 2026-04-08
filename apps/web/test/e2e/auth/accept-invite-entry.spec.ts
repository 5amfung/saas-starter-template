import { expect, test } from '@playwright/test';
import {
  VALID_PASSWORD,
  createSeededUser,
  uniqueEmail,
  waitForTestEmail,
} from '@workspace/test-utils';
import { completeStripeCheckout } from '../lib/complete-stripe-checkout';
import { parseCookieHeader } from '../lib/parse-cookie-header';
import type { Page } from '@playwright/test';

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

async function createInvitationForEmail(
  page: Page,
  baseURL: string,
  inviteeEmail: string
): Promise<{ invitationUrl: string; workspaceId: string }> {
  const ownerEmail = uniqueEmail('invite-owner');
  const { cookie } = await createSeededUser(baseURL, {
    email: ownerEmail,
    password: VALID_PASSWORD,
  });

  await page.context().addCookies(parseCookieHeader(cookie));
  await page.goto('/ws');
  await page.waitForURL(/\/ws\/.+\/overview/, { timeout: 15000 });

  const workspaceMatch = page.url().match(/\/ws\/([^/]+)\/overview/);
  if (!workspaceMatch) {
    throw new Error(`Could not extract workspace id from ${page.url()}`);
  }

  const workspaceId = workspaceMatch[1];

  await page.goto(`/ws/${workspaceId}/members`);
  await page.waitForURL(`**/ws/${workspaceId}/members`, { timeout: 15000 });
  await page.getByRole('button', { name: 'Invite', exact: true }).click();
  const dialog = page.getByRole('alertdialog');
  await expect(dialog).toBeVisible({ timeout: 10000 });

  const upgradeButton = dialog.getByRole('button', { name: /upgrade to/i });
  if (await upgradeButton.isVisible()) {
    await upgradeButton.click();
    await completeStripeCheckout(page);
    await page.goto(`/ws/${workspaceId}/members`);
    await page.waitForURL(`**/ws/${workspaceId}/members`, { timeout: 15000 });
    await page.getByRole('button', { name: 'Invite', exact: true }).click();
  }

  const inviteDialog = page.getByRole('alertdialog');
  await expect(inviteDialog).toBeVisible({ timeout: 10000 });
  await expect(inviteDialog.getByText('Invite Member')).toBeVisible({
    timeout: 5000,
  });
  await inviteDialog.locator('#invite-member-email').fill(inviteeEmail);
  await inviteDialog.getByRole('button', { name: 'Send Invitation' }).click();
  await expect(page.getByText('Invitation sent.').last()).toBeVisible({
    timeout: 10000,
  });

  return {
    invitationUrl: await getInvitationUrl(baseURL, inviteeEmail),
    workspaceId,
  };
}

async function signInAsUnverifiedUser(
  page: Page,
  baseURL: string,
  email: string
): Promise<Array<string>> {
  const signupResponse = await fetch(`${baseURL}/api/auth/sign-up/email`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Origin: baseURL,
    },
    body: JSON.stringify({
      email,
      password: VALID_PASSWORD,
      name: 'Invite Unverified',
    }),
  });
  expect(signupResponse.ok).toBeTruthy();

  await page.goto('/signin');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password', { exact: true }).fill(VALID_PASSWORD);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();

  await expect(page).toHaveURL(/\/verify/, { timeout: 15000 });

  return (await page.context().cookies()).map((cookie) => cookie.name);
}

test.describe('Accept-invite entry policy', () => {
  test('unauthenticated invite visit redirects to sign-up and preserves return target', async ({
    browser,
    baseURL,
  }) => {
    const setupPage = await browser.newPage();
    const { invitationUrl } = await createInvitationForEmail(
      setupPage,
      baseURL!,
      uniqueEmail('invite-guest')
    );
    await setupPage.close();

    const page = await browser.newPage();
    await page.goto(invitationUrl);

    await expect(page).toHaveURL(/\/signup\?redirect=/, { timeout: 15000 });
    expect(page.url()).toContain(
      encodeURIComponent(
        new URL(invitationUrl).pathname + new URL(invitationUrl).search
      )
    );
    await expect(
      page.getByText('Create your account', { exact: true })
    ).toBeVisible();
    await page.close();
  });

  test('unverified signed-in invite visit signs out to sign-up and preserves return target', async ({
    browser,
    baseURL,
  }) => {
    const inviteeEmail = uniqueEmail('invite-unverified');
    const invitationSetupPage = await browser.newPage();
    const { invitationUrl } = await createInvitationForEmail(
      invitationSetupPage,
      baseURL!,
      inviteeEmail
    );
    await invitationSetupPage.close();

    const page = await browser.newPage();
    const sessionCookieNames = await signInAsUnverifiedUser(
      page,
      baseURL!,
      inviteeEmail
    );
    await page.goto(invitationUrl);

    await expect(page).toHaveURL(/\/signup\?redirect=/, { timeout: 15000 });
    expect(page.url()).toContain(
      encodeURIComponent(
        new URL(invitationUrl).pathname + new URL(invitationUrl).search
      )
    );
    await expect(
      page.getByText('Create your account', { exact: true })
    ).toBeVisible();

    const remainingCookieNames = (await page.context().cookies()).map(
      (cookie) => cookie.name
    );
    expect(
      sessionCookieNames.some((name) => remainingCookieNames.includes(name))
    ).toBe(false);

    await page.goto('/ws');
    await page.waitForURL(/\/signin(?:\?|$)/, { timeout: 15000 });
    await page.close();
  });

  test('verified signed-in invite visit accepts the invitation', async ({
    browser,
    baseURL,
  }) => {
    const inviteeEmail = uniqueEmail('invite-verified');
    const invitationSetupPage = await browser.newPage();
    const { invitationUrl, workspaceId } = await createInvitationForEmail(
      invitationSetupPage,
      baseURL!,
      inviteeEmail
    );
    await invitationSetupPage.close();

    const { cookie } = await createSeededUser(baseURL!, {
      email: inviteeEmail,
      password: VALID_PASSWORD,
    });

    const page = await browser.newPage();
    await page.context().addCookies(parseCookieHeader(cookie));
    await page.goto(invitationUrl);

    await page.waitForURL(`**/ws/${workspaceId}/overview`, { timeout: 15000 });
    await expect(page).not.toHaveURL(/\/accept-invite/);
    await page.goto(`/ws/${workspaceId}/members`);
    await page.waitForURL(`**/ws/${workspaceId}/members`, { timeout: 15000 });
    await expect(
      page.getByRole('cell', { name: inviteeEmail, exact: true })
    ).toBeVisible();
    await page.close();
  });
});
