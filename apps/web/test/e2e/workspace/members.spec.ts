import { expect, test } from '@playwright/test';
import {
  VALID_PASSWORD,
  createVerifiedUser,
  uniqueEmail,
  waitForTestEmail,
} from '@workspace/test-utils';
import { completeStripeCheckout } from '../lib/complete-stripe-checkout';
import { toCookieHeader } from '../lib/parse-cookie-header';
import type { Page } from '@playwright/test';

/**
 * Signs in via the UI sign-in form, extracts the workspaceId from the URL
 * after redirect, navigates to the members page, and returns the workspaceId.
 */
async function signInAndGoToMembers(
  page: Page,
  credentials: { email: string; password: string }
): Promise<string> {
  await page.goto('/signin');
  await page.getByLabel('Email').fill(credentials.email);
  await page.getByLabel('Password', { exact: true }).fill(credentials.password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();

  // Wait for redirect to workspace overview.
  await page.waitForURL(/\/ws\/.*\/overview/, { timeout: 15000 });

  const url = page.url();
  const match = url.match(/\/ws\/([^/]+)\//);
  const workspaceId = match?.[1];
  if (!workspaceId)
    throw new Error(`Could not extract workspaceId from ${url}`);

  await page.goto(`/ws/${workspaceId}/members`, {
    waitUntil: 'domcontentloaded',
  });
  await page.waitForURL(`**/ws/${workspaceId}/members`);

  return workspaceId;
}

/**
 * Resets the browser to a signed-out state so the next /signin visit renders
 * the guest form instead of redirecting an existing authenticated session.
 */
async function resetToSignedOutState(page: Page): Promise<void> {
  await page.evaluate(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });
  await page.context().clearCookies();
  await page.goto('/signin');
  await page.waitForURL(/\/signin(?:\?|$)/, { timeout: 15000 });
  await expect(page.getByLabel('Email')).toBeVisible({ timeout: 10000 });
}

/**
 * Polls the test email API for the invitation email and returns its accept URL.
 */
async function getInvitationUrl(
  baseURL: string,
  to: string,
  maxRetries = 10
): Promise<string> {
  const invitationEmail = await waitForTestEmail(
    baseURL,
    to,
    (email) =>
      email.subject.toLowerCase().includes('join') &&
      Boolean(email.invitationUrl),
    maxRetries
  );

  if (!invitationEmail?.invitationUrl) {
    throw new Error(`No invitation URL captured for ${to}.`);
  }

  return invitationEmail.invitationUrl;
}

function getInvitationId(invitationUrl: string): string {
  const id = new URL(invitationUrl).searchParams.get('id');
  if (!id) {
    throw new Error(`Invitation URL did not include an id: ${invitationUrl}`);
  }
  return id;
}

/**
 * Accepts a workspace invitation programmatically.
 * Signs in as the invitee via API and accepts the invitation by ID.
 */
async function acceptInvitationViaApi(
  baseURL: string,
  inviteeCredentials: { email: string; password: string },
  invitationId: string
): Promise<void> {
  // Sign in as invitee to get session cookie.
  const signinResponse = await fetch(`${baseURL}/api/auth/sign-in/email`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Origin: baseURL,
    },
    body: JSON.stringify({
      email: inviteeCredentials.email,
      password: inviteeCredentials.password,
    }),
  });

  if (!signinResponse.ok) {
    const body = await signinResponse.text();
    throw new Error(
      `Invitee sign-in failed (${signinResponse.status}): ${body}`
    );
  }

  const inviteeCookie = toCookieHeader(
    signinResponse.headers.get('set-cookie') ?? ''
  );

  // Accept the invitation.
  const acceptResponse = await fetch(
    `${baseURL}/api/auth/organization/accept-invitation`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: inviteeCookie,
        Origin: baseURL,
      },
      body: JSON.stringify({ invitationId }),
    }
  );

  if (!acceptResponse.ok) {
    const body = await acceptResponse.text();
    throw new Error(
      `Invitation acceptance failed (${acceptResponse.status}): ${body}`
    );
  }
}

/**
 * Creates a verified user and sends an invitation from the owner's workspace,
 * then accepts the invitation via API. Returns the invitee credentials.
 */
async function setupInvitedMember(
  page: Page,
  baseURL: string,
  workspaceId: string,
  emailPrefix: string,
  role: 'member' | 'admin' = 'member'
): Promise<{ email: string; password: string }> {
  const inviteeEmail = uniqueEmail(emailPrefix);
  const inviteePassword = VALID_PASSWORD;

  // Create the invitee as a verified user before sending invitation.
  await createVerifiedUser(baseURL, {
    email: inviteeEmail,
    password: inviteePassword,
  });

  // Send invitation from the members page (owner should already be on the page).
  await page.getByRole('button', { name: 'Invite', exact: true }).click();

  // Wait for a dialog to appear — either the upgrade prompt or the invite dialog.
  const alertdialog = page.getByRole('alertdialog');
  await expect(alertdialog).toBeVisible({ timeout: 10000 });

  // Handle upgrade prompt if on free plan — upgrade first.
  const upgradeBtn = alertdialog.getByRole('button', { name: /upgrade to/i });
  if (await upgradeBtn.isVisible()) {
    await upgradeBtn.click();
    await completeStripeCheckout(page);
    await page.waitForURL(new RegExp(`/ws/${workspaceId}/(overview|billing)`), {
      timeout: 15000,
    });
    await page.getByRole('link', { name: 'Members' }).click();
    await page.waitForURL(`**/ws/${workspaceId}/members`);
    await page.getByRole('button', { name: 'Invite', exact: true }).click();
  }

  // Fill invite dialog.
  await expect(page.getByText('Invite Member')).toBeVisible({ timeout: 5000 });
  await page.getByLabel('Email').fill(inviteeEmail);
  if (role === 'admin') {
    await page.getByRole('combobox').click();
    await page.getByRole('option', { name: 'admin' }).click();
  }
  await page.getByRole('button', { name: 'Send Invitation' }).click();
  await expect(page.getByRole('alertdialog')).not.toBeVisible({
    timeout: 10000,
  });

  const invitationUrl = await getInvitationUrl(baseURL, inviteeEmail, 10);
  const invitationId = getInvitationId(invitationUrl);

  await acceptInvitationViaApi(
    baseURL,
    {
      email: inviteeEmail,
      password: inviteePassword,
    },
    invitationId
  );

  await page.goto(`/ws/${workspaceId}/members`, {
    waitUntil: 'domcontentloaded',
  });
  await page.waitForURL(`**/ws/${workspaceId}/members`);
  await expect(page.getByRole('cell', { name: inviteeEmail })).toBeVisible({
    timeout: 15000,
  });

  return { email: inviteeEmail, password: inviteePassword };
}

/**
 * Upgrades the workspace from Free to Starter via Stripe Checkout.
 * Clicks Invite to trigger the upgrade prompt, completes checkout,
 * and navigates back to the members page.
 */
async function upgradeViaInvitePrompt(
  page: Page,
  workspaceId: string
): Promise<void> {
  await page.getByRole('button', { name: 'Invite', exact: true }).click();
  const upgradeDialog = page.getByRole('alertdialog');
  await expect(
    upgradeDialog.getByRole('button', { name: /upgrade to/i })
  ).toBeVisible({ timeout: 10000 });
  await upgradeDialog.getByRole('button', { name: /upgrade to/i }).click();
  await completeStripeCheckout(page);
  await page.waitForURL(new RegExp(`/ws/${workspaceId}/(overview|billing)`), {
    timeout: 15000,
  });
  await page.getByRole('link', { name: 'Members' }).click();
  await page.waitForURL(`**/ws/${workspaceId}/members`);
}

// ── Tests ──────────────────────────────────────────────────────────────────

test.describe('Workspace Members Page', () => {
  // test.describe.configure({ mode: 'serial' });

  // ── 1. Renders and shows current user as owner ─────────────────────────

  test('renders and shows current user as owner', async ({ page, baseURL }) => {
    const email = uniqueEmail('owner-render');
    await createVerifiedUser(baseURL!, { email, password: VALID_PASSWORD });
    await signInAndGoToMembers(page, { email, password: VALID_PASSWORD });

    // "Team Members" tab should be active.
    const membersTab = page.getByRole('tab', { name: 'Team Members' });
    await expect(membersTab).toHaveAttribute('aria-selected', 'true');

    // Table should show the owner's email.
    await expect(
      page.getByRole('row').filter({ hasText: email }).first()
    ).toBeVisible();

    // Owner role should be displayed.
    await expect(
      page.getByRole('cell', { name: 'owner', exact: true })
    ).toBeVisible();

    // Footer should show "1 member".
    await expect(page.getByText('1 member', { exact: false })).toBeVisible();
  });

  // ── 2. Correct column headers ──────────────────────────────────────────

  test('correct column headers', async ({ page, baseURL }) => {
    const email = uniqueEmail('col-headers');
    await createVerifiedUser(baseURL!, { email, password: VALID_PASSWORD });
    await signInAndGoToMembers(page, { email, password: VALID_PASSWORD });

    // "Email Address" header should be sortable (has cursor-pointer class and SVG icon).
    const emailHeader = page.getByRole('columnheader').filter({
      hasText: 'Email Address',
    });
    await expect(emailHeader).toBeVisible();
    await expect(emailHeader).toHaveClass(/cursor-pointer/);
    await expect(emailHeader.locator('svg')).toBeVisible();

    // "Role" header should NOT be sortable (no cursor-pointer class).
    const roleHeader = page.getByRole('columnheader').filter({
      hasText: 'Role',
    });
    await expect(roleHeader).toBeVisible();
    await expect(roleHeader).not.toHaveClass(/cursor-pointer/);
  });

  // ── 3. Free-plan Invite shows upgrade prompt ──────────────────────────

  test('free-plan invite shows upgrade prompt', async ({ page, baseURL }) => {
    // Create a fresh user on the free plan.
    const email = uniqueEmail('free-plan');
    await createVerifiedUser(baseURL!, { email, password: VALID_PASSWORD });

    await signInAndGoToMembers(page, {
      email,
      password: VALID_PASSWORD,
    });

    // Click Invite.
    await page.getByRole('button', { name: 'Invite', exact: true }).click();

    // Upgrade prompt dialog should open (alertdialog role).
    const dialog = page.getByRole('alertdialog');
    await expect(dialog).toBeVisible({ timeout: 5000 });

    // Should show member limit info.
    await expect(dialog.getByText('1/1 members')).toBeVisible();
    await expect(dialog.getByText('Free')).toBeVisible();

    // Should have upgrade and dismiss buttons.
    await expect(
      dialog.getByRole('button', { name: 'Upgrade to Starter' })
    ).toBeVisible();
    await expect(
      dialog.getByRole('button', { name: 'Maybe later' })
    ).toBeVisible();

    // Should NOT be the invite dialog.
    await expect(dialog.getByText('Invite Member')).not.toBeVisible();
  });

  // ── 4. Upgrade prompt "Maybe later" dismisses ─────────────────────────

  test('upgrade prompt "Maybe later" dismisses', async ({ page, baseURL }) => {
    const email = uniqueEmail('dismiss-upgrade');
    await createVerifiedUser(baseURL!, { email, password: VALID_PASSWORD });

    await signInAndGoToMembers(page, { email, password: VALID_PASSWORD });

    await page.getByRole('button', { name: 'Invite', exact: true }).click();

    const dialog = page.getByRole('alertdialog');
    await expect(dialog).toBeVisible({ timeout: 5000 });

    // Click "Maybe later".
    await dialog.getByRole('button', { name: 'Maybe later' }).click();

    // Dialog should close.
    await expect(dialog).not.toBeVisible();

    // Page should be unchanged — still on members page.
    await expect(page.getByRole('tab', { name: 'Team Members' })).toBeVisible();
  });

  // ── 5. Upgrade to Starter then invite ──────────────────────────────────

  test('upgrade to Starter then invite', async ({ page, baseURL }) => {
    test.setTimeout(120_000);
    const ownerEmail = uniqueEmail('upgrade-owner');
    await createVerifiedUser(baseURL!, {
      email: ownerEmail,
      password: VALID_PASSWORD,
    });

    const workspaceId = await signInAndGoToMembers(page, {
      email: ownerEmail,
      password: VALID_PASSWORD,
    });

    // Click Invite — should show upgrade prompt.
    await page.getByRole('button', { name: 'Invite', exact: true }).click();
    const upgradeDialog = page.getByRole('alertdialog');
    await expect(upgradeDialog).toBeVisible({ timeout: 5000 });

    // Click upgrade.
    await upgradeDialog
      .getByRole('button', { name: 'Upgrade to Starter' })
      .click();

    // Complete Stripe checkout.
    await completeStripeCheckout(page);

    // Return to members page.
    await page.goto(`/ws/${workspaceId}/members`);
    await page.waitForURL(`**/ws/${workspaceId}/members`);

    // Click Invite again — should now show invite dialog, not upgrade prompt.
    await page.getByRole('button', { name: 'Invite', exact: true }).click();

    const inviteDialog = page.getByRole('alertdialog');
    await expect(inviteDialog).toBeVisible({ timeout: 5000 });
    await expect(inviteDialog.getByText('Invite Member')).toBeVisible();

    // Fill email and submit.
    const inviteeEmail = uniqueEmail('invitee');
    await inviteDialog.getByLabel('Email').fill(inviteeEmail);
    await inviteDialog.getByRole('button', { name: 'Send Invitation' }).click();

    // Toast should confirm.
    await expect(page.getByText('Invitation sent.')).toBeVisible({
      timeout: 10000,
    });
  });

  // ── 6. Invited member in Pending Invitations tab ───────────────────────

  test('invited member in Pending Invitations tab', async ({
    page,
    baseURL,
  }) => {
    test.setTimeout(120_000);
    const ownerEmail = uniqueEmail('inv-tab-owner');
    await createVerifiedUser(baseURL!, {
      email: ownerEmail,
      password: VALID_PASSWORD,
    });

    const workspaceId = await signInAndGoToMembers(page, {
      email: ownerEmail,
      password: VALID_PASSWORD,
    });

    // Upgrade plan first (free plan has 1/1 limit).
    await page.getByRole('button', { name: 'Invite', exact: true }).click();
    const upgradeDialog = page.getByRole('alertdialog');
    await expect(
      upgradeDialog.getByRole('button', { name: /upgrade to/i })
    ).toBeVisible({ timeout: 10000 });
    await upgradeDialog.getByRole('button', { name: /upgrade to/i }).click();
    await completeStripeCheckout(page);
    await page.goto(`/ws/${workspaceId}/members`);
    await page.waitForURL(`**/ws/${workspaceId}/members`);

    // Send invitation.
    await page.getByRole('button', { name: 'Invite', exact: true }).click();
    const inviteDialog = page.getByRole('alertdialog');
    await expect(inviteDialog.getByText('Invite Member')).toBeVisible({
      timeout: 5000,
    });
    const inviteeEmail = uniqueEmail('inv-tab-invitee');
    await inviteDialog.getByLabel('Email').fill(inviteeEmail);
    await inviteDialog.getByRole('button', { name: 'Send Invitation' }).click();
    await expect(page.getByText('Invitation sent.')).toBeVisible({
      timeout: 10000,
    });

    // Switch to "Pending Invitations" tab.
    await page.getByRole('tab', { name: 'Pending Invitations' }).click();

    // Invitee row should appear.
    await expect(page.getByRole('cell', { name: inviteeEmail })).toBeVisible();

    // Role should be "member" (default).
    await expect(page.getByRole('cell', { name: 'member' })).toBeVisible();

    // Invited date should be non-empty.
    const dateCell = page.getByRole('row').nth(1).getByRole('cell').nth(2);
    await expect(dateCell).not.toHaveText('');

    // Footer should show "1 invitation".
    await expect(
      page.getByText('1 invitation', { exact: false })
    ).toBeVisible();
  });

  // ── 7. Owner can transfer workspace ownership ──────────────────────────

  test('owner can transfer workspace ownership to another member', async ({
    page,
    baseURL,
  }) => {
    test.setTimeout(120_000);

    const ownerEmail = uniqueEmail('transfer-owner');
    await createVerifiedUser(baseURL!, {
      email: ownerEmail,
      password: VALID_PASSWORD,
    });

    const workspaceId = await signInAndGoToMembers(page, {
      email: ownerEmail,
      password: VALID_PASSWORD,
    });

    await upgradeViaInvitePrompt(page, workspaceId);

    const target = await setupInvitedMember(
      page,
      baseURL!,
      workspaceId,
      'transfer-target',
      'admin'
    );

    const targetRow = page.getByRole('row', { name: target.email });
    await targetRow.getByRole('button', { name: 'Row actions' }).click();

    const transferItem = page.getByRole('menuitem', {
      name: 'Transfer ownership',
    });
    await expect(transferItem).toBeVisible({ timeout: 5000 });
    await transferItem.click();

    const dialog = page.getByRole('alertdialog');
    await expect(dialog).toContainText(
      'The workspace must always have exactly one owner.'
    );
    await expect(dialog).toContainText(
      'Billing stays with the workspace, but payment transfer in Stripe must be handled separately.'
    );
    await expect(dialog).toContainText(
      'This action cannot be reversed unless the new owner transfers ownership back to you.'
    );
    await expect(
      dialog.getByRole('button', { name: 'Transfer ownership' })
    ).toBeDisabled();

    await dialog.getByLabel(/type TRANSFER to confirm/i).fill('TRANSFER');
    await dialog.getByRole('button', { name: 'Transfer ownership' }).click();
    await expect(dialog).not.toBeVisible({ timeout: 10000 });

    await page.goto(`/ws/${workspaceId}/members`, {
      waitUntil: 'domcontentloaded',
    });
    await page.waitForURL(`**/ws/${workspaceId}/members`);

    await expect(page.getByRole('row', { name: target.email })).toContainText(
      'owner'
    );
    await expect(page.getByRole('row', { name: ownerEmail })).toContainText(
      'admin'
    );

    const formerOwnerRow = page.getByRole('row', { name: ownerEmail });
    await formerOwnerRow.getByRole('button', { name: 'Row actions' }).click();
    await expect(
      page.getByRole('menuitem', { name: 'Transfer ownership' })
    ).toHaveCount(0);
  });

  // ── 7. Resend invitation ───────────────────────────────────────────────

  test('resend invitation', async ({ page, baseURL }) => {
    test.setTimeout(120_000);
    const ownerEmail = uniqueEmail('resend-owner');
    await createVerifiedUser(baseURL!, {
      email: ownerEmail,
      password: VALID_PASSWORD,
    });

    const workspaceId = await signInAndGoToMembers(page, {
      email: ownerEmail,
      password: VALID_PASSWORD,
    });

    // Upgrade from free plan (1/1 member limit) then open invite dialog.
    await upgradeViaInvitePrompt(page, workspaceId);
    await page.getByRole('button', { name: 'Invite', exact: true }).click();

    const inviteDialog = page.getByRole('alertdialog');
    await expect(inviteDialog.getByText('Invite Member')).toBeVisible({
      timeout: 5000,
    });
    const inviteeEmail = uniqueEmail('resend-invitee');
    await inviteDialog.getByLabel('Email').fill(inviteeEmail);
    await inviteDialog.getByRole('button', { name: 'Send Invitation' }).click();
    await expect(page.getByText('Invitation sent.')).toBeVisible({
      timeout: 10000,
    });

    // Go to Pending Invitations tab.
    await page.getByRole('tab', { name: 'Pending Invitations' }).click();
    await expect(page.getByRole('cell', { name: inviteeEmail })).toBeVisible();

    // Open row actions for the invitee and click "Resend invitation".
    const inviteeRow = page.getByRole('row', { name: inviteeEmail });
    await inviteeRow.getByRole('button', { name: 'Row actions' }).click();
    await page.getByRole('menuitem', { name: 'Resend invitation' }).click();

    // Toast confirms resend.
    await expect(page.getByText('Invitation resent.')).toBeVisible({
      timeout: 10000,
    });

    // Row should still be present.
    await expect(page.getByRole('cell', { name: inviteeEmail })).toBeVisible();
  });

  // ── 8. Remove invitation ───────────────────────────────────────────────

  test('remove invitation', async ({ page, baseURL }) => {
    test.setTimeout(120_000);
    const ownerEmail = uniqueEmail('remove-inv-owner');
    await createVerifiedUser(baseURL!, {
      email: ownerEmail,
      password: VALID_PASSWORD,
    });

    const workspaceId = await signInAndGoToMembers(page, {
      email: ownerEmail,
      password: VALID_PASSWORD,
    });

    // Upgrade from free plan (1/1 member limit) then open invite dialog.
    await upgradeViaInvitePrompt(page, workspaceId);
    await page.getByRole('button', { name: 'Invite', exact: true }).click();

    const inviteDialog = page.getByRole('alertdialog');
    await expect(inviteDialog.getByText('Invite Member')).toBeVisible({
      timeout: 5000,
    });
    const inviteeEmail = uniqueEmail('remove-inv-invitee');
    await inviteDialog.getByLabel('Email').fill(inviteeEmail);
    await inviteDialog.getByRole('button', { name: 'Send Invitation' }).click();
    await expect(page.getByText('Invitation sent.')).toBeVisible({
      timeout: 10000,
    });

    // Go to Pending Invitations tab.
    await page.getByRole('tab', { name: 'Pending Invitations' }).click();
    await expect(page.getByRole('cell', { name: inviteeEmail })).toBeVisible();

    // Open row actions for the invitee and click "Remove invitation".
    const inviteeRow = page.getByRole('row', { name: inviteeEmail });
    await inviteeRow.getByRole('button', { name: 'Row actions' }).click();
    await page.getByRole('menuitem', { name: 'Remove invitation' }).click();

    // Toast confirms removal.
    await expect(page.getByText('Invitation removed.')).toBeVisible({
      timeout: 10000,
    });

    // Row should be gone.
    await expect(
      page.getByRole('cell', { name: inviteeEmail })
    ).not.toBeVisible();

    // Empty state should show.
    await expect(page.getByText('No pending invitations found.')).toBeVisible();

    // Footer should show "0 invitations".
    await expect(
      page.getByText('0 invitations', { exact: false })
    ).toBeVisible();
  });

  // ── 9. Remove member (owner perspective) ───────────────────────────────

  test('remove member (owner perspective)', async ({ page, baseURL }) => {
    test.setTimeout(120_000);
    const ownerEmail = uniqueEmail('rm-member-owner');
    await createVerifiedUser(baseURL!, {
      email: ownerEmail,
      password: VALID_PASSWORD,
    });

    const workspaceId = await signInAndGoToMembers(page, {
      email: ownerEmail,
      password: VALID_PASSWORD,
    });

    // Set up an accepted member.
    const member = await setupInvitedMember(
      page,
      baseURL!,
      workspaceId,
      'rm-member-invitee'
    );

    // Reload the members page to see the new member.
    await page.goto(`/ws/${workspaceId}/members`);
    await page.waitForURL(`**/ws/${workspaceId}/members`);

    // Should show 2 members.
    await expect(page.getByText('2 members')).toBeVisible({ timeout: 10000 });

    // Find the member row (not the owner row) and open actions.
    const memberRow = page.getByRole('row').filter({ hasText: member.email });
    await memberRow
      .getByRole('button', { name: `Row actions for ${member.email}` })
      .click();

    // Click "Remove".
    await page.getByRole('menuitem', { name: 'Remove' }).click();
    const removeDialog = page.getByRole('alertdialog');
    await expect(removeDialog).toBeVisible();
    await removeDialog.getByPlaceholder('REMOVE').fill('REMOVE');
    await removeDialog.getByRole('button', { name: 'Confirm remove' }).click();

    // Toast confirms removal.
    await expect(page.getByText('Membership removed.')).toBeVisible({
      timeout: 10000,
    });

    // Member row should be gone.
    await expect(
      page.getByRole('cell', { name: member.email })
    ).not.toBeVisible();

    // Footer should show "1 member".
    await expect(page.getByText('1 member', { exact: false })).toBeVisible();
  });

  // ── 10. Sort by email ──────────────────────────────────────────────────

  test('sort by email', async ({ page, baseURL }) => {
    const email = uniqueEmail('sort-email');
    await createVerifiedUser(baseURL!, { email, password: VALID_PASSWORD });
    await signInAndGoToMembers(page, { email, password: VALID_PASSWORD });

    const emailHeader = page.getByRole('columnheader').filter({
      hasText: 'Email Address',
    });

    // First click: ascending.
    await emailHeader.click();
    await expect(emailHeader).toHaveAttribute('aria-sort', 'ascending');

    // Second click: descending.
    await emailHeader.click();
    await expect(emailHeader).toHaveAttribute('aria-sort', 'descending');

    // Third click: unsorted (no aria-sort or "none").
    await emailHeader.click();
    const ariaSort = await emailHeader.getAttribute('aria-sort');
    expect(!ariaSort || ariaSort === 'none').toBeTruthy();
  });

  // ── 11. Sort invitations ───────────────────────────────────────────────

  test('sort invitations', async ({ page, baseURL }) => {
    test.setTimeout(120_000);
    const ownerEmail = uniqueEmail('sort-inv-owner');
    await createVerifiedUser(baseURL!, {
      email: ownerEmail,
      password: VALID_PASSWORD,
    });

    const workspaceId = await signInAndGoToMembers(page, {
      email: ownerEmail,
      password: VALID_PASSWORD,
    });

    // Upgrade from free plan (1/1 member limit).
    await upgradeViaInvitePrompt(page, workspaceId);

    // Send two invitations with predictable email prefixes.
    const aaaEmail = `aaa-sort-${Date.now()}@example.com`;
    const zzzEmail = `zzz-sort-${Date.now()}@example.com`;

    for (const inviteeEmail of [aaaEmail, zzzEmail]) {
      await page.getByRole('button', { name: 'Invite', exact: true }).click();
      const dialog = page.getByRole('alertdialog');
      await expect(dialog.getByText('Invite Member')).toBeVisible({
        timeout: 5000,
      });
      await dialog.getByLabel('Email').fill(inviteeEmail);
      await dialog.getByRole('button', { name: 'Send Invitation' }).click();
      await expect(page.getByText('Invitation sent.')).toBeVisible({
        timeout: 10000,
      });
      // Wait for toast to dismiss before next action.
      await page.waitForTimeout(500);
    }

    // Switch to Pending Invitations tab.
    await page.getByRole('tab', { name: 'Pending Invitations' }).click();

    // Sort by Email ascending.
    const emailHeader = page.getByRole('columnheader').filter({
      hasText: 'Email',
    });
    await emailHeader.first().click();

    // First data row should be the "aaa" email.
    const firstRowEmail = page
      .getByRole('row')
      .nth(1)
      .getByRole('cell')
      .first();
    await expect(firstRowEmail).toContainText('aaa-sort');

    // Sort by Email descending.
    await emailHeader.first().click();

    // First data row should now be the "zzz" email.
    await expect(firstRowEmail).toContainText('zzz-sort');

    // Sort by Invited Date.
    const dateHeader = page.getByRole('columnheader').filter({
      hasText: 'Invited Date',
    });
    await dateHeader.click();
    // Just verify no errors — date sorting should cycle without issues.
    await dateHeader.click();
    await dateHeader.click();
  });

  // ── 12. Rows-per-page selector ─────────────────────────────────────────

  test('rows-per-page selector', async ({ page, baseURL }) => {
    const email = uniqueEmail('rows-per-page');
    await createVerifiedUser(baseURL!, { email, password: VALID_PASSWORD });
    await signInAndGoToMembers(page, { email, password: VALID_PASSWORD });

    // Default should be "10".
    const selectTrigger = page.locator('#members-rows-per-page');
    await expect(selectTrigger).toContainText('10');

    // "Page 1 of" should be visible.
    await expect(page.getByText(/Page 1 of/)).toBeVisible();

    // Change to "25".
    await selectTrigger.click();
    await page.getByRole('option', { name: '25' }).click();
    await expect(selectTrigger).toContainText('25');
    await expect(page.getByText(/Page 1 of/)).toBeVisible();

    // Change to "50".
    await selectTrigger.click();
    await page.getByRole('option', { name: '50' }).click();
    await expect(selectTrigger).toContainText('50');
    await expect(page.getByText(/Page 1 of/)).toBeVisible();
  });

  // ── 13. Pagination disabled on single page ─────────────────────────────

  test('pagination disabled on single page', async ({ page, baseURL }) => {
    const email = uniqueEmail('pagination');
    await createVerifiedUser(baseURL!, { email, password: VALID_PASSWORD });
    await signInAndGoToMembers(page, { email, password: VALID_PASSWORD });

    // Should show "Page 1 of 1".
    await expect(page.getByText('Page 1 of 1')).toBeVisible();

    // All 4 navigation buttons should be disabled.
    const firstPageBtn = page.getByRole('button', { name: 'Go to first page' });
    const prevPageBtn = page.getByRole('button', {
      name: 'Go to previous page',
    });
    const nextPageBtn = page.getByRole('button', { name: 'Go to next page' });
    const lastPageBtn = page.getByRole('button', { name: 'Go to last page' });

    await expect(firstPageBtn).toBeDisabled();
    await expect(prevPageBtn).toBeDisabled();
    await expect(nextPageBtn).toBeDisabled();
    await expect(lastPageBtn).toBeDisabled();
  });

  // ── 14. Multi-page navigation ──────────────────────────────────────────

  test('multi-page navigation', async ({ page, baseURL }) => {
    test.setTimeout(180_000);
    const ownerEmail = uniqueEmail('pagination-owner');
    await createVerifiedUser(baseURL!, {
      email: ownerEmail,
      password: VALID_PASSWORD,
    });

    const workspaceId = await signInAndGoToMembers(page, {
      email: ownerEmail,
      password: VALID_PASSWORD,
    });

    await upgradeViaInvitePrompt(page, workspaceId);

    for (let index = 0; index < 11; index++) {
      await page.getByRole('button', { name: 'Invite', exact: true }).click();

      const inviteDialog = page.getByRole('alertdialog');
      await expect(inviteDialog.getByText('Invite Member')).toBeVisible({
        timeout: 5000,
      });

      await inviteDialog
        .getByLabel('Email')
        .fill(uniqueEmail(`pagination-invite-${index + 1}`));
      await inviteDialog
        .getByRole('button', { name: 'Send Invitation' })
        .click();
      await expect(page.getByText('Invitation sent.').last()).toBeVisible({
        timeout: 10000,
      });
      await expect(inviteDialog).not.toBeVisible({ timeout: 10000 });
    }

    await page.getByRole('tab', { name: 'Pending Invitations' }).click();
    await expect(
      page.getByText('11 invitations', { exact: false })
    ).toBeVisible({
      timeout: 10000,
    });

    const firstPageBtn = page.getByRole('button', { name: 'Go to first page' });
    const prevPageBtn = page.getByRole('button', {
      name: 'Go to previous page',
    });
    const nextPageBtn = page.getByRole('button', { name: 'Go to next page' });
    const lastPageBtn = page.getByRole('button', { name: 'Go to last page' });

    await expect(page.getByText('Page 1 of 2')).toBeVisible();
    await expect(firstPageBtn).toBeDisabled();
    await expect(prevPageBtn).toBeDisabled();
    await expect(nextPageBtn).toBeEnabled();
    await expect(lastPageBtn).toBeEnabled();

    await nextPageBtn.click();
    await expect(page.getByText('Page 2 of 2')).toBeVisible();
    await expect(firstPageBtn).toBeEnabled();
    await expect(prevPageBtn).toBeEnabled();
    await expect(nextPageBtn).toBeDisabled();
    await expect(lastPageBtn).toBeDisabled();

    await prevPageBtn.click();
    await expect(page.getByText('Page 1 of 2')).toBeVisible();
  });

  // ── 15. Empty email rejected ───────────────────────────────────────────

  test('empty email rejected', async ({ page, baseURL }) => {
    test.setTimeout(120_000);
    const ownerEmail = uniqueEmail('empty-email-owner');
    await createVerifiedUser(baseURL!, {
      email: ownerEmail,
      password: VALID_PASSWORD,
    });

    const workspaceId = await signInAndGoToMembers(page, {
      email: ownerEmail,
      password: VALID_PASSWORD,
    });

    // Upgrade from free plan (1/1 member limit) then open invite dialog.
    await upgradeViaInvitePrompt(page, workspaceId);
    await page.getByRole('button', { name: 'Invite', exact: true }).click();

    const dialog = page.getByRole('alertdialog');
    await expect(dialog.getByText('Invite Member')).toBeVisible({
      timeout: 5000,
    });

    // Submit with empty email.
    await dialog.getByRole('button', { name: 'Send Invitation' }).click();

    // Toast should show validation error.
    await expect(page.getByText('Email address is required.')).toBeVisible({
      timeout: 5000,
    });

    // Dialog should remain open.
    await expect(dialog).toBeVisible();
  });

  // ── 16. Malformed email rejected ───────────────────────────────────────

  test('malformed email rejected', async ({ page, baseURL }) => {
    test.setTimeout(120_000);
    const ownerEmail = uniqueEmail('malformed-email-owner');
    await createVerifiedUser(baseURL!, {
      email: ownerEmail,
      password: VALID_PASSWORD,
    });

    const workspaceId = await signInAndGoToMembers(page, {
      email: ownerEmail,
      password: VALID_PASSWORD,
    });

    // Upgrade from free plan (1/1 member limit) then open invite dialog.
    await upgradeViaInvitePrompt(page, workspaceId);
    await page.getByRole('button', { name: 'Invite', exact: true }).click();

    const dialog = page.getByRole('alertdialog');
    await expect(dialog.getByText('Invite Member')).toBeVisible({
      timeout: 5000,
    });

    // Fill malformed email.
    await dialog.getByLabel('Email').fill('not-an-email');
    await dialog.getByRole('button', { name: 'Send Invitation' }).click();

    // Toast should show validation error.
    await expect(
      page.getByText('Please enter a valid email address.')
    ).toBeVisible({ timeout: 5000 });
  });

  // ── 17. Invite hidden for member role ──────────────────────────────────

  test('invite hidden for member role', async ({ page, baseURL }) => {
    test.setTimeout(120_000);
    const ownerEmail = uniqueEmail('hidden-inv-owner');
    await createVerifiedUser(baseURL!, {
      email: ownerEmail,
      password: VALID_PASSWORD,
    });

    const workspaceId = await signInAndGoToMembers(page, {
      email: ownerEmail,
      password: VALID_PASSWORD,
    });

    // Set up an accepted member.
    const member = await setupInvitedMember(
      page,
      baseURL!,
      workspaceId,
      'hidden-inv-member'
    );

    // Sign out and sign in as member.
    await resetToSignedOutState(page);
    await signInAndGoToMembers(page, member);

    // Invite button should NOT be visible.
    await expect(
      page.getByRole('button', { name: 'Invite', exact: true })
    ).not.toBeVisible();
  });

  // ── 18. Member sees Remove disabled on others ──────────────────────────

  test('member sees Remove disabled on others', async ({ page, baseURL }) => {
    test.setTimeout(120_000);
    const ownerEmail = uniqueEmail('disabled-rm-owner');
    await createVerifiedUser(baseURL!, {
      email: ownerEmail,
      password: VALID_PASSWORD,
    });

    const workspaceId = await signInAndGoToMembers(page, {
      email: ownerEmail,
      password: VALID_PASSWORD,
    });

    // Set up an accepted member.
    const member = await setupInvitedMember(
      page,
      baseURL!,
      workspaceId,
      'disabled-rm-member'
    );

    // Sign out and sign in as member.
    await resetToSignedOutState(page);
    await signInAndGoToMembers(page, member);

    // Navigate to the owner's workspace members page.
    await page.goto(`/ws/${workspaceId}/members`);
    await page.waitForURL(`**/ws/${workspaceId}/members`);

    // Find the owner row and open actions.
    const ownerRow = page.getByRole('row').filter({ hasText: ownerEmail });
    await ownerRow
      .getByRole('button', { name: `Row actions for ${ownerEmail}` })
      .click();

    // "Remove" should be visible but disabled.
    const removeItem = page.getByRole('menuitem', { name: 'Remove' });
    await expect(removeItem).toBeVisible();
    await expect(removeItem).toBeDisabled();
  });

  // ── 19. Owner's own row shows disabled "Leave" ─────────────────────────

  test('owner\'s own row shows disabled "Leave"', async ({ page, baseURL }) => {
    test.setTimeout(120_000);
    const ownerEmail = uniqueEmail('owner-leave-owner');
    await createVerifiedUser(baseURL!, {
      email: ownerEmail,
      password: VALID_PASSWORD,
    });

    const workspaceId = await signInAndGoToMembers(page, {
      email: ownerEmail,
      password: VALID_PASSWORD,
    });

    // Ensure there are 2 members so the row exists and the owner action state is visible.
    await setupInvitedMember(page, baseURL!, workspaceId, 'owner-leave-member');

    // Reload to see both members.
    await page.goto(`/ws/${workspaceId}/members`);
    await page.waitForURL(`**/ws/${workspaceId}/members`);

    // Find the owner row and open actions.
    const ownerRow = page.getByRole('row').filter({ hasText: ownerEmail });
    await ownerRow
      .getByRole('button', { name: `Row actions for ${ownerEmail}` })
      .click();

    // "Leave" should be visible but disabled for owners.
    const leaveItem = page.getByRole('menuitem', { name: 'Leave' });
    await expect(leaveItem).toBeVisible();
    await expect(leaveItem).toBeDisabled();

    // "Remove" should NOT be visible.
    await expect(
      page.getByRole('menuitem', { name: 'Remove' })
    ).not.toBeVisible();
  });

  test('workspace admin can invite a new member', async ({ page, baseURL }) => {
    test.setTimeout(120_000);

    const ownerEmail = uniqueEmail('admin-invite-owner');
    const ownerCredentials = {
      email: ownerEmail,
      password: VALID_PASSWORD,
    };

    await createVerifiedUser(baseURL!, ownerCredentials);
    const workspaceId = await signInAndGoToMembers(page, ownerCredentials);
    await upgradeViaInvitePrompt(page, workspaceId);
    const adminCredentials = await setupInvitedMember(
      page,
      baseURL!,
      workspaceId,
      'admin-invite-admin',
      'admin'
    );

    await resetToSignedOutState(page);
    await signInAndGoToMembers(page, adminCredentials);
    await page.goto(`/ws/${workspaceId}/members`);
    await page.waitForURL(`**/ws/${workspaceId}/members`);

    await page.getByRole('button', { name: 'Invite', exact: true }).click();
    await expect(page.getByText('Invite Member')).toBeVisible({
      timeout: 5000,
    });
    const inviteeEmail = uniqueEmail('admin-invite-member');
    await page.getByLabel('Email').fill(inviteeEmail);
    await page.getByRole('button', { name: 'Send Invitation' }).click();

    await expect(page.getByRole('alertdialog')).not.toBeVisible({
      timeout: 10000,
    });

    await page.getByRole('tab', { name: 'Pending Invitations' }).click();
    await expect(page.getByText(inviteeEmail)).toBeVisible({
      timeout: 10000,
    });
  });

  // ── 20. Member's own row shows "Leave" ─────────────────────────────────

  test('member\'s own row shows "Leave"', async ({ page, baseURL }) => {
    test.setTimeout(120_000);
    const ownerEmail = uniqueEmail('member-leave-owner');
    await createVerifiedUser(baseURL!, {
      email: ownerEmail,
      password: VALID_PASSWORD,
    });

    const workspaceId = await signInAndGoToMembers(page, {
      email: ownerEmail,
      password: VALID_PASSWORD,
    });

    // Set up an accepted member.
    const member = await setupInvitedMember(
      page,
      baseURL!,
      workspaceId,
      'member-leave-member'
    );

    // Sign out and sign in as member.
    await resetToSignedOutState(page);
    await signInAndGoToMembers(page, member);

    // Navigate to the owner's workspace.
    await page.goto(`/ws/${workspaceId}/members`);
    await page.waitForURL(`**/ws/${workspaceId}/members`);

    // Find the member's own row and open actions.
    const memberRow = page.getByRole('row').filter({ hasText: member.email });
    await memberRow
      .getByRole('button', { name: `Row actions for ${member.email}` })
      .click();

    // "Leave" should be visible and enabled.
    const leaveItem = page.getByRole('menuitem', { name: 'Leave' });
    await expect(leaveItem).toBeVisible();
    await expect(leaveItem).toBeEnabled();

    // "Remove" should NOT be visible.
    await expect(
      page.getByRole('menuitem', { name: 'Remove' })
    ).not.toBeVisible();
  });

  // ── 21. Leave redirects away ───────────────────────────────────────────

  test('leave redirects away', async ({ page, baseURL }) => {
    test.setTimeout(120_000);
    const ownerEmail = uniqueEmail('leave-redir-owner');
    await createVerifiedUser(baseURL!, {
      email: ownerEmail,
      password: VALID_PASSWORD,
    });

    const workspaceId = await signInAndGoToMembers(page, {
      email: ownerEmail,
      password: VALID_PASSWORD,
    });

    // Set up an accepted member.
    const member = await setupInvitedMember(
      page,
      baseURL!,
      workspaceId,
      'leave-redir-member'
    );

    // Sign out and sign in as member.
    await resetToSignedOutState(page);
    await signInAndGoToMembers(page, member);

    // Navigate to the owner's workspace.
    await page.goto(`/ws/${workspaceId}/members`);
    await page.waitForURL(`**/ws/${workspaceId}/members`);

    // Find member's own row and click Leave.
    const memberRow = page.getByRole('row').filter({ hasText: member.email });
    await memberRow
      .getByRole('button', { name: `Row actions for ${member.email}` })
      .click();
    await page.getByRole('menuitem', { name: 'Leave' }).click();

    const leaveDialog = page.getByRole('alertdialog');
    await expect(leaveDialog).toBeVisible();
    await leaveDialog.getByPlaceholder('LEAVE').fill('LEAVE');
    await leaveDialog.getByRole('button', { name: 'Confirm leave' }).click();

    // Toast should confirm.
    await expect(page.getByText('You have left the workspace.')).toBeVisible({
      timeout: 10000,
    });

    // URL should change away from the workspace.
    await page.waitForURL((url) => !url.pathname.includes(workspaceId), {
      timeout: 10000,
    });
  });

  // ── 22. Footer count updates after removal ─────────────────────────────

  test('footer count updates after removal', async ({ page, baseURL }) => {
    test.setTimeout(120_000);
    const ownerEmail = uniqueEmail('footer-rm-owner');
    await createVerifiedUser(baseURL!, {
      email: ownerEmail,
      password: VALID_PASSWORD,
    });

    const workspaceId = await signInAndGoToMembers(page, {
      email: ownerEmail,
      password: VALID_PASSWORD,
    });

    // Set up an accepted member.
    const member = await setupInvitedMember(
      page,
      baseURL!,
      workspaceId,
      'footer-rm-member'
    );

    // Reload to see the new member.
    await page.goto(`/ws/${workspaceId}/members`);
    await page.waitForURL(`**/ws/${workspaceId}/members`);

    // Should show "2 members".
    await expect(page.getByText('2 members')).toBeVisible({ timeout: 10000 });

    // Remove the member.
    const memberRow = page.getByRole('row').filter({ hasText: member.email });
    await memberRow
      .getByRole('button', { name: `Row actions for ${member.email}` })
      .click();
    await page.getByRole('menuitem', { name: 'Remove' }).click();

    const removeDialog = page.getByRole('alertdialog');
    await expect(removeDialog).toBeVisible();
    await removeDialog.getByPlaceholder('REMOVE').fill('REMOVE');
    await removeDialog.getByRole('button', { name: 'Confirm remove' }).click();

    // Wait for removal toast.
    await expect(page.getByText('Membership removed.')).toBeVisible({
      timeout: 10000,
    });

    // Footer should decrement to "1 member".
    await expect(page.getByText('1 member', { exact: false })).toBeVisible();
  });

  // ── 23. Invitation count updates ───────────────────────────────────────

  test('invitation count updates', async ({ page, baseURL }) => {
    test.setTimeout(120_000);
    const ownerEmail = uniqueEmail('inv-count-owner');
    await createVerifiedUser(baseURL!, {
      email: ownerEmail,
      password: VALID_PASSWORD,
    });

    const workspaceId = await signInAndGoToMembers(page, {
      email: ownerEmail,
      password: VALID_PASSWORD,
    });

    // Upgrade from free plan (1/1 member limit).
    await upgradeViaInvitePrompt(page, workspaceId);

    // Send invitation.
    await page.getByRole('button', { name: 'Invite', exact: true }).click();
    const dialog = page.getByRole('alertdialog');
    await expect(dialog.getByText('Invite Member')).toBeVisible({
      timeout: 5000,
    });
    const inviteeEmail = uniqueEmail('inv-count-invitee');
    await dialog.getByLabel('Email').fill(inviteeEmail);
    await dialog.getByRole('button', { name: 'Send Invitation' }).click();
    await expect(page.getByText('Invitation sent.')).toBeVisible({
      timeout: 10000,
    });

    // Switch to Pending Invitations tab.
    await page.getByRole('tab', { name: 'Pending Invitations' }).click();

    // Should show "1 invitation".
    await expect(
      page.getByText('1 invitation', { exact: false })
    ).toBeVisible();

    // Remove the invitation.
    const inviteeRow = page.getByRole('row', { name: inviteeEmail });
    await inviteeRow.getByRole('button', { name: 'Row actions' }).click();
    await page.getByRole('menuitem', { name: 'Remove invitation' }).click();
    await expect(page.getByText('Invitation removed.')).toBeVisible({
      timeout: 10000,
    });

    // Should show "0 invitations".
    await expect(
      page.getByText('0 invitations', { exact: false })
    ).toBeVisible();
  });

  // ── 24. Loading skeletons ──────────────────────────────────────────────

  test('loading skeletons', async ({ page, baseURL }) => {
    const email = uniqueEmail('skeletons');
    await createVerifiedUser(baseURL!, { email, password: VALID_PASSWORD });

    // Intercept the listMembers API to delay the response.
    await page.route(
      '**/api/auth/organization/list-members**',
      async (route) => {
        await new Promise((r) => setTimeout(r, 1500));
        await route.continue();
      }
    );

    await signInAndGoToMembers(page, { email, password: VALID_PASSWORD });

    // Skeleton elements with animate-pulse should be visible during loading.
    const skeletons = page.locator('.animate-pulse');
    await expect(skeletons.first()).toBeVisible({ timeout: 3000 });

    // Wait for data to load and skeletons to disappear.
    await expect(
      page.getByRole('row').filter({ hasText: email }).first()
    ).toBeVisible({
      timeout: 10000,
    });
  });

  // ── 25. No empty state with member ─────────────────────────────────────

  test('no empty state with member', async ({ page, baseURL }) => {
    const email = uniqueEmail('no-empty');
    await createVerifiedUser(baseURL!, { email, password: VALID_PASSWORD });
    await signInAndGoToMembers(page, { email, password: VALID_PASSWORD });

    // Owner row should be visible.
    await expect(
      page.getByRole('row').filter({ hasText: email }).first()
    ).toBeVisible();

    // "No team members found." should NOT be visible.
    await expect(page.getByText('No team members found.')).not.toBeVisible();
  });

  // ── 26. Empty state on Pending Invitations ─────────────────────────────

  test('empty state on Pending Invitations', async ({ page, baseURL }) => {
    const email = uniqueEmail('empty-invitations');
    await createVerifiedUser(baseURL!, { email, password: VALID_PASSWORD });
    await signInAndGoToMembers(page, { email, password: VALID_PASSWORD });

    // Switch to Pending Invitations tab.
    await page.getByRole('tab', { name: 'Pending Invitations' }).click();

    // Empty state should show.
    await expect(page.getByText('No pending invitations found.')).toBeVisible();
  });
});
