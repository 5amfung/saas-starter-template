import { expect, test } from '@playwright/test';
import {
  VALID_PASSWORD,
  createVerifiedUser,
  uniqueEmail,
  waitForTestEmail,
} from '@workspace/test-utils';
import { completeStripeCheckout } from '../lib/complete-stripe-checkout';
import { parseCookieHeader, toCookieHeader } from '../lib/parse-cookie-header';
import type { Page } from '@playwright/test';

/**
 * Creates a verified user, injects the session cookie into the browser,
 * navigates to /ws to discover the workspace ID, then navigates to the
 * billing page. Returns the workspace ID for further use.
 */
async function setupUserAndGoToBilling(
  page: Page,
  baseURL: string
): Promise<{ workspaceId: string }> {
  const email = uniqueEmail();
  const { cookie } = await createVerifiedUser(baseURL, {
    email,
    password: VALID_PASSWORD,
  });

  await page
    .context()
    .addCookies(parseCookieHeader(cookie, new URL(baseURL).hostname));

  // Navigate to /ws — the app redirects to /ws/<workspaceId>/overview.
  await page.goto('/ws');
  await page.waitForURL(/\/ws\/.*\/overview/, { timeout: 15000 });

  const workspaceId = page.url().match(/\/ws\/([^/]+)\//)?.[1];
  if (!workspaceId) throw new Error('Could not extract workspaceId from URL');

  await waitForWorkspacePageReady(page, workspaceId, 'overview');
  await openWorkspacePageFromSidebar(page, workspaceId, 'Billing', 'billing');
  await expect(page.getByText('Current plan')).toBeVisible({ timeout: 15000 });

  return { workspaceId };
}

async function waitForWorkspacePageReady(
  page: Page,
  workspaceId: string,
  pagePath: 'overview' | 'members' | 'billing'
): Promise<void> {
  await page.waitForURL(`**/ws/${workspaceId}/${pagePath}`, {
    timeout: 15000,
  });

  if (pagePath === 'overview') {
    await expect(page.getByRole('heading', { name: 'Overview' })).toBeVisible({
      timeout: 15000,
    });
    return;
  }

  if (pagePath === 'members') {
    await expect(page.getByRole('tab', { name: 'Team Members' })).toBeVisible({
      timeout: 15000,
    });
    return;
  }

  await expect(page.getByText('Current plan')).toBeVisible({
    timeout: 15000,
  });
}

async function openWorkspacePageFromSidebar(
  page: Page,
  workspaceId: string,
  linkName: 'Billing' | 'Members',
  pagePath: 'billing' | 'members'
): Promise<void> {
  await page
    .locator('a[data-slot="sidebar-menu-button"]')
    .filter({ hasText: linkName })
    .click();
  await waitForWorkspacePageReady(page, workspaceId, pagePath);
}

async function waitForWorkspaceShellReady(
  page: Page,
  workspaceId: string
): Promise<void> {
  await page.waitForURL(
    new RegExp(`/ws/${workspaceId}/(overview|billing|members)`),
    {
      timeout: 15000,
    }
  );
}

async function navigateToWorkspaceBilling(
  page: Page,
  workspaceId: string
): Promise<void> {
  const billingLink = page
    .locator('a[data-slot="sidebar-menu-button"]')
    .filter({ hasText: 'Billing' });

  if (await billingLink.isVisible()) {
    await billingLink.click();
    await waitForWorkspacePageReady(page, workspaceId, 'billing');
    return;
  }

  try {
    await page.goto(`/ws/${workspaceId}/billing`);
    await waitForWorkspacePageReady(page, workspaceId, 'billing');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!message.includes('interrupted by another navigation')) {
      throw error;
    }

    await waitForWorkspaceShellReady(page, workspaceId);
    await openWorkspacePageFromSidebar(page, workspaceId, 'Billing', 'billing');
  }
}

async function openManagePlanDialog(page: Page) {
  await page.getByRole('button', { name: 'Manage plan' }).click();
  const dialog = page.locator('[role="alertdialog"]');
  await expect(dialog).toBeVisible({ timeout: 10000 });
  return dialog;
}

async function clickUpgradeInManagePlanDialog(
  page: Page,
  planName: 'Starter' | 'Pro',
  options?: { annual?: boolean }
) {
  const dialog = await openManagePlanDialog(page);

  if (options?.annual) {
    await dialog.getByRole('button', { name: 'Annual billing' }).click();
  }

  const planNameText = dialog.getByText(planName, { exact: true });
  const planColumn = planNameText
    .locator('xpath=ancestor::div[contains(@class,"rounded-lg")]')
    .first();
  await expect(planColumn).toBeVisible();
  await planColumn.getByRole('button', { name: 'Upgrade' }).click();
}

async function signInAndGoToWorkspacePage(
  page: Page,
  credentials: { email: string; password: string },
  pagePath: 'members' | 'billing' | 'overview'
): Promise<string> {
  await page.goto('/signin');
  await page.getByLabel('Email').fill(credentials.email);
  await page.getByLabel('Password', { exact: true }).fill(credentials.password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await page.waitForURL(/\/ws\/.*\/overview/, { timeout: 15000 });

  const workspaceId = page.url().match(/\/ws\/([^/]+)\//)?.[1];
  if (!workspaceId) {
    throw new Error('Could not extract workspaceId from URL');
  }

  if (pagePath === 'billing') {
    await waitForWorkspacePageReady(page, workspaceId, 'overview');
    await openWorkspacePageFromSidebar(page, workspaceId, 'Billing', 'billing');
  } else if (pagePath !== 'overview') {
    await waitForWorkspacePageReady(page, workspaceId, 'overview');
    await openWorkspacePageFromSidebar(page, workspaceId, 'Members', 'members');
  }

  return workspaceId;
}

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
      data: {
        email: inviteeCredentials.email,
        password: inviteeCredentials.password,
      },
    }
  );

  if (!signinResponse.ok()) {
    const body = await signinResponse.text();
    throw new Error(
      `Invitee sign-in failed (${signinResponse.status()}): ${body}`
    );
  }

  const inviteeCookie = toCookieHeader(
    signinResponse.headers()['set-cookie'] ?? ''
  );

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
    const body = await acceptResponse.text();
    throw new Error(
      `Invitation acceptance failed (${acceptResponse.status()}): ${body}`
    );
  }
}

async function setupInvitedMember(
  page: Page,
  baseURL: string,
  workspaceId: string,
  emailPrefix: string
): Promise<{ email: string; password: string }> {
  const inviteeEmail = uniqueEmail(emailPrefix);
  const inviteePassword = VALID_PASSWORD;

  await createVerifiedUser(baseURL, {
    email: inviteeEmail,
    password: inviteePassword,
  });

  await page.getByRole('button', { name: 'Invite' }).click();

  const alertdialog = page.getByRole('alertdialog');
  await expect(alertdialog).toBeVisible({ timeout: 10000 });

  const upgradeBtn = alertdialog.getByRole('button', { name: /upgrade to/i });
  if (await upgradeBtn.isVisible()) {
    await upgradeBtn.click();
    await completeStripeCheckout(page, { redirectPattern: /localhost/ });
    await waitForWorkspaceShellReady(page, workspaceId);
    await openWorkspacePageFromSidebar(page, workspaceId, 'Members', 'members');
    await page.getByRole('button', { name: 'Invite' }).click();
  }

  await expect(page.getByText('Invite Member')).toBeVisible({ timeout: 5000 });
  await page.getByLabel('Email').fill(inviteeEmail);
  await page.getByRole('button', { name: 'Send Invitation' }).click();

  await expect(page.getByText('Invitation sent.').last()).toBeVisible({
    timeout: 10000,
  });

  const invitationUrl = await getInvitationUrl(baseURL, inviteeEmail, 10);
  const invitationId = getInvitationId(invitationUrl);

  await acceptInvitationViaApi(
    page,
    baseURL,
    {
      email: inviteeEmail,
      password: inviteePassword,
    },
    invitationId
  );

  return { email: inviteeEmail, password: inviteePassword };
}

// ── Test Suite ───────────────────────────────────────────────────────────────

test.describe('Workspace Billing', () => {
  // Billing tests interact with Stripe and can be slow.
  test.setTimeout(120000);

  // ── 1. Free plan card display ──────────────────────────────────────────

  test('free plan card displays current plan details', async ({
    page,
    baseURL,
  }) => {
    await setupUserAndGoToBilling(page, baseURL!);

    // Current plan card should show "Current plan", "Free", "Free forever", and "1 member".
    await expect(page.getByText('Current plan')).toBeVisible();
    await expect(
      page.locator('[data-slot="card-title"]').getByText('Free')
    ).toBeVisible();
    await expect(page.getByText('Free forever')).toBeVisible();
    await expect(page.getByText('1 member')).toBeVisible();

    // Free plan should show "Manage plan" and hide "Billing portal".
    await expect(
      page.getByRole('button', { name: 'Manage plan' })
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Billing portal' })
    ).not.toBeVisible();
  });

  // ── 2. Manage plan dialog: Starter option ─────────────────────────────

  test('manage plan dialog shows starter option and features', async ({
    page,
    baseURL,
  }) => {
    await setupUserAndGoToBilling(page, baseURL!);
    const dialog = await openManagePlanDialog(page);

    await expect(dialog.getByText('Starter').first()).toBeVisible();
    await expect(dialog.getByText('$5/mo').first()).toBeVisible();
    await expect(dialog.getByText('Up to 5 members')).toBeVisible();
    const starterUpgradeButton = dialog
      .getByText('Starter', { exact: true })
      .locator('xpath=ancestor::div[contains(@class,"rounded-lg")]')
      .first()
      .getByRole('button', { name: 'Upgrade' });
    await expect(starterUpgradeButton).toBeVisible();
    await expect(starterUpgradeButton).toBeEnabled();
  });

  // ── 3. Manage plan dialog: Pro option ─────────────────────────────────

  test('manage plan dialog shows pro option and features', async ({
    page,
    baseURL,
  }) => {
    await setupUserAndGoToBilling(page, baseURL!);
    const dialog = await openManagePlanDialog(page);

    await expect(dialog.getByText('Pro').first()).toBeVisible();
    await expect(dialog.getByText('$49/mo')).toBeVisible();
    await expect(dialog.getByText('Up to 25 members')).toBeVisible();
    await expect(dialog.getByText('Priority Support').first()).toBeVisible();
    const proUpgradeButton = dialog
      .getByText('Pro', { exact: true })
      .locator('xpath=ancestor::div[contains(@class,"rounded-lg")]')
      .first()
      .getByRole('button', { name: 'Upgrade' });
    await expect(proUpgradeButton).toBeVisible();
    await expect(proUpgradeButton).toBeEnabled();
  });

  // ── 4. Starter Annual toggle (in manage dialog) ──────────────────────

  test('starter annual toggle changes price and shows bonus', async ({
    page,
    baseURL,
  }) => {
    await setupUserAndGoToBilling(page, baseURL!);
    const dialog = await openManagePlanDialog(page);

    const starterAnnualToggle = dialog
      .getByRole('button', { name: 'Annual billing' })
      .first();
    await starterAnnualToggle.click();

    // Price should change to annual equivalent (~$4.17/mo).
    await expect(dialog.getByText('$4.17/mo')).toBeVisible();
  });

  // ── 5. Pro Annual toggle (in manage dialog) ──────────────────────────

  test('pro annual toggle changes price and shows bonus', async ({
    page,
    baseURL,
  }) => {
    await setupUserAndGoToBilling(page, baseURL!);
    const dialog = await openManagePlanDialog(page);

    const proAnnualToggle = dialog
      .getByRole('button', { name: 'Annual billing' })
      .first();
    await proAnnualToggle.click();

    // Price should change to annual equivalent (~$40.83/mo).
    await expect(dialog.getByText('$40.83/mo')).toBeVisible();
  });

  // ── 6. Starter Monthly toggle restores (in manage dialog) ────────────

  test('starter monthly toggle restores original price', async ({
    page,
    baseURL,
  }) => {
    await setupUserAndGoToBilling(page, baseURL!);
    const dialog = await openManagePlanDialog(page);

    const starterAnnualToggle = dialog
      .getByRole('button', { name: 'Annual billing' })
      .first();
    await starterAnnualToggle.click();
    await expect(dialog.getByText('$4.17/mo')).toBeVisible();

    const starterMonthlyToggle = dialog
      .getByRole('button', { name: 'Monthly billing' })
      .first();
    await starterMonthlyToggle.click();

    // Price should restore to $5/mo.
    await expect(dialog.getByText('$5/mo').first()).toBeVisible();
    // Annual price should disappear from the Starter card.
    await expect(dialog.getByText('$4.17/mo')).not.toBeVisible();
  });

  // ── 7. Invoices empty state ───────────────────────────────────────────

  test('invoices section shows empty state', async ({ page, baseURL }) => {
    await setupUserAndGoToBilling(page, baseURL!);

    await expect(page.getByRole('heading', { name: 'Invoices' })).toBeVisible();
    // Month combobox is visible (Select trigger).
    await expect(page.getByRole('combobox')).toBeVisible();
    await expect(page.getByText('No invoices for this period.')).toBeVisible();
  });

  // ── 8. Previous month empty ───────────────────────────────────────────

  test('previous month also shows empty invoices', async ({
    page,
    baseURL,
  }) => {
    await setupUserAndGoToBilling(page, baseURL!);

    // Open the month dropdown.
    await page.getByRole('combobox').click();

    // Select the second option (previous month).
    const options = page.getByRole('option');
    await options.nth(1).click();

    await expect(page.getByText('No invoices for this period.')).toBeVisible();
  });

  // ── 9. Upgrade button shows "Redirecting..." then navigates to Stripe ─

  test('upgrade button shows redirecting state and navigates to stripe', async ({
    page,
    baseURL,
  }) => {
    await setupUserAndGoToBilling(page, baseURL!);

    await clickUpgradeInManagePlanDialog(page, 'Starter');

    // Should navigate to Stripe Checkout.
    await page.waitForURL(/checkout\.stripe\.com/, { timeout: 30000 });
    expect(page.url()).toContain('checkout.stripe.com');
  });

  // ── 10. Full checkout: Free -> Starter monthly ─────────────────────────

  test('full checkout upgrades from free to starter monthly', async ({
    page,
    baseURL,
  }) => {
    await setupUserAndGoToBilling(page, baseURL!);

    // Click upgrade to Starter from Manage plan.
    await clickUpgradeInManagePlanDialog(page, 'Starter');

    // Complete Stripe Checkout.
    await completeStripeCheckout(page);

    // After redirect, billing page should show Starter as current plan.
    await expect(page.getByText('Current plan')).toBeVisible({
      timeout: 15000,
    });
    await expect(
      page.locator('[data-slot="card-title"]').getByText('Starter')
    ).toBeVisible();
    await expect(page.getByText('$5/mo')).toBeVisible();
    await expect(page.getByText(/Renews on/)).toBeVisible();
  });

  // ── 11. Post-upgrade shows "Manage plan" and "Billing portal" ─────────

  test('post-upgrade shows manage plan and billing portal', async ({
    page,
    baseURL,
  }) => {
    await setupUserAndGoToBilling(page, baseURL!);

    // Upgrade to Starter.
    await clickUpgradeInManagePlanDialog(page, 'Starter');
    await completeStripeCheckout(page);

    // Wait for billing page to load after redirect.
    await expect(page.getByText('Current plan')).toBeVisible({
      timeout: 15000,
    });

    // Both controls should be visible.
    await expect(
      page.getByRole('button', { name: 'Manage plan' })
    ).toBeVisible();
    await expect(page.getByText('Billing portal')).toBeVisible();
  });

  // ── 12. Invoice appears after upgrade ─────────────────────────────────

  test('invoice appears after upgrade', async ({ page, baseURL }) => {
    await setupUserAndGoToBilling(page, baseURL!);

    // Upgrade to Starter.
    await clickUpgradeInManagePlanDialog(page, 'Starter');
    await completeStripeCheckout(page);

    // Wait for billing page to load.
    await expect(page.getByText('Current plan')).toBeVisible({
      timeout: 15000,
    });

    // Invoices section should show the new invoice.
    await expect(page.getByRole('heading', { name: 'Invoices' })).toBeVisible();
    await expect(page.getByText('paid')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('$5.00')).toBeVisible();
    await expect(page.getByText('View').first()).toBeVisible();
  });

  // ── 13. Full checkout: Free -> Pro annual ──────────────────────────────

  test('full checkout upgrades from free to pro annual', async ({
    page,
    baseURL,
  }) => {
    const { workspaceId } = await setupUserAndGoToBilling(page, baseURL!);

    // Toggle Pro to Annual and upgrade via Manage plan.
    await clickUpgradeInManagePlanDialog(page, 'Pro', { annual: true });
    await completeStripeCheckout(page, {
      redirectPattern: new RegExp(`/ws/${workspaceId}/(?:billing|overview)`),
    });

    // After redirect, billing page should show Pro as current plan.
    await expect(page.getByText('Current plan')).toBeVisible({
      timeout: 15000,
    });
    await expect(
      page.locator('[data-slot="card-title"]').getByText('Pro')
    ).toBeVisible();
  });

  // ── 14. Manage plan dialog content ────────────────────────────────────

  test('manage plan dialog shows all plans and actions', async ({
    page,
    baseURL,
  }) => {
    await setupUserAndGoToBilling(page, baseURL!);

    // Upgrade to Starter first.
    await clickUpgradeInManagePlanDialog(page, 'Starter');
    await completeStripeCheckout(page);
    await expect(page.getByText('Current plan')).toBeVisible({
      timeout: 15000,
    });

    // Open manage plan dialog.
    const dialog = await openManagePlanDialog(page);

    // Dialog should show title and current plan description.
    await expect(
      page.getByRole('heading', { name: 'Manage your plan' }).nth(1)
    ).toBeVisible();
    await expect(page.getByText('Current plan: Starter')).toBeVisible();

    // All three plan columns should be visible: Free, Starter, Pro.
    await expect(dialog.getByText('Free').first()).toBeVisible();
    await expect(dialog.getByText('Starter').first()).toBeVisible();
    await expect(dialog.getByText('Pro').first()).toBeVisible();

    // Current plan button should be disabled.
    await expect(
      dialog.getByRole('button', { name: 'Current plan' })
    ).toBeDisabled();

    // Upgrade and Downgrade buttons should be visible.
    await expect(dialog.getByRole('button', { name: 'Upgrade' })).toBeVisible();
    await expect(
      dialog.getByRole('button', { name: 'Downgrade' }).first()
    ).toBeVisible();
  });

  // ── 15. Manage plan Annual toggle ─────────────────────────────────────

  test('manage plan dialog annual toggle updates prices', async ({
    page,
    baseURL,
  }) => {
    await setupUserAndGoToBilling(page, baseURL!);

    // Upgrade to Starter first.
    await clickUpgradeInManagePlanDialog(page, 'Starter');
    await completeStripeCheckout(page);
    await expect(page.getByText('Current plan')).toBeVisible({
      timeout: 15000,
    });

    // Open manage plan dialog.
    const dialog = await openManagePlanDialog(page);

    // Switch to Annual.
    await dialog.getByRole('button', { name: 'Annual billing' }).click();

    // Prices should update for paid plans.
    await expect(dialog.getByText('$4.17/mo')).toBeVisible();
    await expect(dialog.getByText('$40.83/mo')).toBeVisible();
  });

  // ── 16. Manage plan close without changes ─────────────────────────────

  test('manage plan dialog closes without changes', async ({
    page,
    baseURL,
  }) => {
    await setupUserAndGoToBilling(page, baseURL!);

    // Upgrade to Starter first.
    await clickUpgradeInManagePlanDialog(page, 'Starter');
    await completeStripeCheckout(page);
    await expect(page.getByText('Current plan')).toBeVisible({
      timeout: 15000,
    });

    // Open manage plan dialog.
    const dialog = await openManagePlanDialog(page);
    await expect(
      page.getByRole('heading', { name: 'Manage your plan' }).nth(1)
    ).toBeVisible();

    // Close the dialog.
    await dialog.getByRole('button', { name: 'Close' }).click();

    // Dialog should be dismissed.
    await expect(
      page.getByRole('heading', { name: 'Manage your plan' }).nth(1)
    ).not.toBeVisible();

    // Plan should remain Starter.
    await expect(
      page.locator('[data-slot="card-title"]').getByText('Starter')
    ).toBeVisible();
  });

  // ── 17. Downgrade to Free opens confirm dialog ────────────────────────

  test('downgrade to free opens confirmation dialog', async ({
    page,
    baseURL,
  }) => {
    await setupUserAndGoToBilling(page, baseURL!);

    // Upgrade to Starter first.
    await clickUpgradeInManagePlanDialog(page, 'Starter');
    await completeStripeCheckout(page);
    await expect(page.getByText('Current plan')).toBeVisible({
      timeout: 15000,
    });

    // Open manage plan dialog.
    const manageDialog = await openManagePlanDialog(page);

    // Click Downgrade on the Free plan column.
    // Free plan uses the "cancel" action, which has label "Downgrade".
    await manageDialog
      .getByRole('button', { name: 'Downgrade' })
      .first()
      .click();

    // Confirm dialog should appear.
    await expect(page.getByText('Downgrade to Free?')).toBeVisible();
    await expect(
      page.getByText(/after that, you will downgrade to:/i)
    ).toBeVisible();

    // Cancel should dismiss the dialog.
    await page.getByRole('button', { name: 'Cancel' }).click();
    await expect(page.getByText('Downgrade to Free?')).not.toBeVisible();
  });

  // ── 18. Cancel subscription -> amber banner ────────────────────────────

  test('cancel subscription shows amber downgrade banner', async ({
    page,
    baseURL,
  }) => {
    await setupUserAndGoToBilling(page, baseURL!);

    // Upgrade to Starter.
    await clickUpgradeInManagePlanDialog(page, 'Starter');
    await completeStripeCheckout(page);
    await expect(page.getByText('Current plan')).toBeVisible({
      timeout: 15000,
    });

    // Open manage plan, downgrade to Free, confirm.
    const manageDialog = await openManagePlanDialog(page);
    await manageDialog
      .getByRole('button', { name: 'Downgrade' })
      .first()
      .click();
    await expect(page.getByText('Downgrade to Free?')).toBeVisible();
    await page.getByRole('button', { name: 'Confirm downgrade' }).click();

    // Toast should confirm cancellation.
    await expect(
      page.getByText('Subscription will cancel at period end.')
    ).toBeVisible({ timeout: 10000 });

    // The optimistic cache patch is overwritten by the query invalidation
    // refetch before the Stripe webhook has updated the DB. Poll with page
    // reloads until the server-side data reflects the cancellation.
    await expect(async () => {
      await page.reload();
      await expect(
        page.getByText(/Your plan will downgrade to Free on/)
      ).toBeVisible({ timeout: 5000 });
    }).toPass({ timeout: 30000 });
    await expect(
      page.getByRole('button', { name: 'Keep subscription' })
    ).toBeVisible();
  });

  // ── 19. "Keep subscription" reactivates ───────────────────────────────

  test('keep subscription reactivates the plan', async ({ page, baseURL }) => {
    await setupUserAndGoToBilling(page, baseURL!);

    // Upgrade to Starter.
    await clickUpgradeInManagePlanDialog(page, 'Starter');
    await completeStripeCheckout(page);
    await expect(page.getByText('Current plan')).toBeVisible({
      timeout: 15000,
    });

    // Cancel: open manage plan, downgrade to Free, confirm.
    const manageDialog = await openManagePlanDialog(page);
    await manageDialog
      .getByRole('button', { name: 'Downgrade' })
      .first()
      .click();
    await page.getByRole('button', { name: 'Confirm downgrade' }).click();
    await expect(
      page.getByText('Subscription will cancel at period end.')
    ).toBeVisible({ timeout: 10000 });

    // The optimistic cache patch (cancelAtPeriodEnd: true) is immediately
    // overwritten by the query invalidation refetch before the Stripe webhook
    // has updated the DB. Poll with page reloads until the server-side data
    // reflects the cancellation and the amber banner appears.
    await expect(async () => {
      await page.reload();
      await expect(
        page.getByRole('button', { name: 'Keep subscription' })
      ).toBeVisible({ timeout: 5000 });
    }).toPass({ timeout: 30000 });

    // Click "Keep subscription" in the amber banner.
    await page.getByRole('button', { name: 'Keep subscription' }).click();

    // Toast should confirm reactivation.
    await expect(page.getByText('Subscription reactivated.')).toBeVisible({
      timeout: 10000,
    });

    // Amber banner should disappear.
    await expect(
      page.getByText(/Your plan will downgrade to Free on/)
    ).not.toBeVisible({ timeout: 10000 });
  });

  // ── 20. Downgrade Pro -> Starter ───────────────────────────────────────

  test('downgrade from pro to starter shows confirm and schedules', async ({
    page,
    baseURL,
  }) => {
    const { workspaceId } = await setupUserAndGoToBilling(page, baseURL!);

    // Upgrade to Pro.
    await clickUpgradeInManagePlanDialog(page, 'Pro');
    await completeStripeCheckout(page, {
      redirectPattern: new RegExp(`/ws/${workspaceId}/(?:billing|overview)`),
    });
    await expect(page.getByText('Current plan')).toBeVisible({
      timeout: 15000,
    });
    await expect(
      page.locator('[data-slot="card-title"]').getByText('Pro')
    ).toBeVisible();

    // Open manage plan.
    const manageDialog = await openManagePlanDialog(page);

    // Click Downgrade on the Starter column.
    // In the manage dialog with Pro as current: Free=Downgrade, Starter=Downgrade, Pro=Current plan.
    // The Starter Downgrade button is the second "Downgrade" button (first is Free).
    await manageDialog
      .getByRole('button', { name: 'Downgrade' })
      .nth(1)
      .click();

    // Confirm dialog should appear with correct details.
    await expect(page.getByText('Downgrade to Starter?')).toBeVisible();
    await expect(
      page.getByText(/after that, you will downgrade to:/i)
    ).toBeVisible();

    // Confirm the downgrade.
    await page.getByRole('button', { name: 'Confirm downgrade' }).click();

    // Toast should confirm scheduling.
    await expect(page.getByText('Downgrade scheduled.')).toBeVisible({
      timeout: 10000,
    });

    // Amber banner should appear showing downgrade to Starter.
    await expect(
      page.getByText(/Your plan will downgrade to Starter on/)
    ).toBeVisible();
  });

  // ── 21. Pending cancel blocks changes ─────────────────────────────────

  test('pending cancellation blocks further changes in manage plan', async ({
    page,
    baseURL,
  }) => {
    await setupUserAndGoToBilling(page, baseURL!);

    // Upgrade to Starter.
    await clickUpgradeInManagePlanDialog(page, 'Starter');
    await completeStripeCheckout(page);
    await expect(page.getByText('Current plan')).toBeVisible({
      timeout: 15000,
    });

    // Cancel: open manage plan, downgrade to Free, confirm.
    let manageDialog = await openManagePlanDialog(page);
    await manageDialog
      .getByRole('button', { name: 'Downgrade' })
      .first()
      .click();
    await page.getByRole('button', { name: 'Confirm downgrade' }).click();
    await expect(
      page.getByText('Subscription will cancel at period end.')
    ).toBeVisible({ timeout: 10000 });

    // Reopen manage plan dialog.
    manageDialog = await openManagePlanDialog(page);

    // Pending cancellation notice should be visible.
    await expect(manageDialog.getByText(/pending cancellation/)).toBeVisible({
      timeout: 10000,
    });

    // All Downgrade buttons should be disabled.
    const downgradeButtons = manageDialog.getByRole('button', {
      name: 'Downgrade',
    });
    const count = await downgradeButtons.count();
    for (let i = 0; i < count; i++) {
      await expect(downgradeButtons.nth(i)).toBeDisabled();
    }
  });

  // ── 22. Member count exceeds limit warning ────────────────────────────

  test('member count exceeds limit shows warning in downgrade dialog', async ({
    page,
    baseURL,
  }) => {
    test.setTimeout(180_000);

    const ownerCredentials = {
      email: uniqueEmail('billing-downgrade-owner'),
      password: VALID_PASSWORD,
    };
    await createVerifiedUser(baseURL!, ownerCredentials);

    const workspaceId = await signInAndGoToWorkspacePage(
      page,
      ownerCredentials,
      'members'
    );

    for (let i = 0; i < 4; i++) {
      await setupInvitedMember(
        page,
        baseURL!,
        workspaceId,
        `billing-downgrade-${i}`
      );
      await resetToSignedOutState(page);
      await signInAndGoToWorkspacePage(page, ownerCredentials, 'members');
    }

    await navigateToWorkspaceBilling(page, workspaceId);
    await expect(page.getByText('Current plan')).toBeVisible({
      timeout: 15000,
    });

    await clickUpgradeInManagePlanDialog(page, 'Pro');
    await completeStripeCheckout(page, {
      redirectPattern: new RegExp(`/ws/${workspaceId}/(?:billing|overview)`),
    });
    await navigateToWorkspaceBilling(page, workspaceId);
    await expect(page.getByText('Current plan')).toBeVisible({
      timeout: 15000,
    });

    await openWorkspacePageFromSidebar(page, workspaceId, 'Members', 'members');
    await setupInvitedMember(
      page,
      baseURL!,
      workspaceId,
      'billing-downgrade-over-limit'
    );
    await resetToSignedOutState(page);
    await signInAndGoToWorkspacePage(page, ownerCredentials, 'billing');

    await navigateToWorkspaceBilling(page, workspaceId);
    await expect(page.getByText('Current plan')).toBeVisible({
      timeout: 15000,
    });

    const manageDialog = await openManagePlanDialog(page);
    await manageDialog
      .getByRole('button', { name: 'Downgrade' })
      .nth(1)
      .click();

    await expect(page.getByText('Downgrade to Starter?')).toBeVisible();
    await expect(
      page.getByText(
        'Any areas exceeding the new plan limits will stop working after the downgrade takes effect.'
      )
    ).toBeVisible({ timeout: 10000 });
  });

  // ── 23. Billing portal navigates to Stripe ────────────────────────────

  test('billing portal navigates to stripe', async ({ page, baseURL }) => {
    await setupUserAndGoToBilling(page, baseURL!);

    // Upgrade to Starter.
    await clickUpgradeInManagePlanDialog(page, 'Starter');
    await completeStripeCheckout(page);
    await expect(page.getByText('Current plan')).toBeVisible({
      timeout: 15000,
    });

    // Click "Billing portal" link.
    await page.getByText('Billing portal').click();

    // Should navigate to Stripe's billing portal.
    await page.waitForURL(/billing\.stripe\.com/, { timeout: 30000 });
    expect(page.url()).toContain('billing.stripe.com');
  });

  // ── 24. Unauthenticated redirect ──────────────────────────────────────

  test('unauthenticated user is redirected to signin', async ({ page }) => {
    // Navigate directly to a billing page without any session.
    await page.goto('/ws/some-nonexistent-id/billing');

    // Should redirect to /signin.
    await page.waitForURL(/\/signin/, { timeout: 15000 });
    expect(page.url()).toMatch(/\/signin/);
  });

  // ── 25. Members without billing capability are denied at the route ───

  test('member without billing capability gets workspace billing 404', async ({
    page,
    baseURL,
  }) => {
    test.setTimeout(180_000);

    const ownerCredentials = {
      email: uniqueEmail('billing-member-owner'),
      password: VALID_PASSWORD,
    };
    await createVerifiedUser(baseURL!, ownerCredentials);

    const workspaceId = await signInAndGoToWorkspacePage(
      page,
      ownerCredentials,
      'members'
    );

    const inviteeCredentials = await setupInvitedMember(
      page,
      baseURL!,
      workspaceId,
      'billing-member-access'
    );

    await resetToSignedOutState(page);
    await signInAndGoToWorkspacePage(page, inviteeCredentials, 'overview');

    await expect(page.getByRole('link', { name: 'Billing' })).not.toBeVisible();

    await page.goto(`/ws/${workspaceId}/billing`);
    await page.waitForLoadState('networkidle');

    await expect(page.getByRole('heading', { name: '404' })).toBeVisible();
    await expect(
      page.getByText("The page you're looking for doesn't exist.")
    ).toBeVisible();
    await expect(page.getByText('Current plan')).not.toBeVisible();
  });

  // ── 26. Concurrent upgrade button lockout ─────────────────────────────

  test('concurrent upgrade flow navigates to stripe checkout', async ({
    page,
    baseURL,
  }) => {
    await setupUserAndGoToBilling(page, baseURL!);

    // Intercept the checkout API call to add a delay, so we can observe the loading state.
    await page.route('**/billing**', async (route) => {
      // Only delay the checkout creation request.
      if (
        route.request().method() === 'POST' &&
        route.request().url().includes('createWorkspaceCheckoutSession')
      ) {
        await new Promise((resolve) => setTimeout(resolve, 3000));
      }
      await route.continue();
    });

    // Click Starter upgrade in modal.
    await clickUpgradeInManagePlanDialog(page, 'Starter');

    // Should navigate to Stripe Checkout.
    await page.waitForURL(/checkout\.stripe\.com/, { timeout: 30000 });
    expect(page.url()).toContain('checkout.stripe.com');
  });
});
