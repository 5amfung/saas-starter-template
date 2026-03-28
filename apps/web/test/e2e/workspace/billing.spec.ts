import { expect, test } from '@playwright/test';
import {
  STRIPE_TEST_CARD,
  VALID_PASSWORD,
  createVerifiedUser,
  uniqueEmail,
} from '@workspace/test-utils';
import { parseCookieHeader } from '../lib/parse-cookie-header';
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

  // Navigate to the billing page.
  await page.goto(`/ws/${workspaceId}/billing`);
  await expect(page.getByText('Current plan')).toBeVisible({ timeout: 15000 });

  return { workspaceId };
}

/**
 * Completes a Stripe Checkout session using the test card.
 *
 * Stripe Checkout renders a card accordion that must be expanded before the
 * card fields become visible. Fields are rendered directly in the main frame
 * (no iframes) on the hosted checkout page at checkout.stripe.com.
 */
async function completeStripeCheckout(
  page: Page,
  redirectPattern: RegExp = /\/billing\?success=true/
): Promise<void> {
  await page.waitForURL(/stripe\.com/, { timeout: 30000 });

  // Step 1: Fill email — this triggers the Stripe Link verification modal
  // if the email is recognized as a Link account.
  const emailField = page.getByRole('textbox', { name: 'Email' });
  await expect(emailField).toBeVisible({ timeout: 10000 });
  await emailField.fill(STRIPE_TEST_CARD.email);

  // Step 2: Dismiss the Link verification modal if it appears.
  // After dismissal, "Save my information" disappears and the page shows
  // a clean payment method accordion with "Continue with Link" next to email.
  const linkDialog = page.getByRole('dialog');
  const dialogAppeared = await linkDialog
    .waitFor({ state: 'visible', timeout: 5000 })
    .then(() => true)
    .catch(() => false);

  if (dialogAppeared) {
    const closeBtn = linkDialog.locator('button').first();
    await closeBtn.click();
    await expect(linkDialog).not.toBeVisible({ timeout: 5000 });
  }

  // Step 3: Select Card payment method. After dismissing Link, the Card
  // accordion is collapsed. Force-click the radio since the accordion
  // button overlay intercepts normal clicks.
  const cardRadio = page.getByRole('radio', { name: 'Card' });
  await cardRadio.click({ force: true });

  // Step 4: Fill card fields (direct inputs on Stripe Checkout, no iframes).
  const cardNumberInput = page.getByPlaceholder('1234 1234 1234 1234');
  await expect(cardNumberInput).toBeVisible({ timeout: 10000 });

  await cardNumberInput.fill(STRIPE_TEST_CARD.number);
  await page.getByPlaceholder('MM / YY').fill(STRIPE_TEST_CARD.expiry);
  await page.getByPlaceholder('CVC').fill(STRIPE_TEST_CARD.cvc);

  const nameInput = page.getByPlaceholder('Full name on card');
  if (await nameInput.isVisible({ timeout: 1000 }).catch(() => false)) {
    await nameInput.fill(STRIPE_TEST_CARD.name);
  }

  const zipInput = page.getByPlaceholder('ZIP');
  if (await zipInput.isVisible({ timeout: 1000 }).catch(() => false)) {
    await zipInput.fill(STRIPE_TEST_CARD.zip);
  }

  // Step 5: Submit.
  await page.getByRole('button', { name: /subscribe/i }).click();

  // Wait for redirect back to the app.
  await page.waitForURL(redirectPattern, { timeout: 60000 });
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

    // Free plan should NOT show "Manage plan" or "Billing portal".
    await expect(page.getByText('Manage plan')).not.toBeVisible();
    await expect(page.getByText('Billing portal')).not.toBeVisible();
  });

  // ── 2. Starter card: $5/mo + features ─────────────────────────────────

  test('starter plan card shows price and features', async ({
    page,
    baseURL,
  }) => {
    await setupUserAndGoToBilling(page, baseURL!);

    await expect(page.getByText('Upgrade to').first()).toBeVisible();
    await expect(page.getByText('Starter').first()).toBeVisible();
    await expect(page.getByText('$5/mo').first()).toBeVisible();
    await expect(page.getByText('Up to 5 members per workspace')).toBeVisible();

    const starterUpgradeButton = page.getByRole('button', {
      name: 'Upgrade to Starter',
    });
    await expect(starterUpgradeButton).toBeVisible();
    await expect(starterUpgradeButton).toBeEnabled();
  });

  // ── 3. Pro card: $49/mo + features ────────────────────────────────────

  test('pro plan card shows price and features', async ({ page, baseURL }) => {
    await setupUserAndGoToBilling(page, baseURL!);

    await expect(page.getByText('Pro').first()).toBeVisible();
    await expect(page.getByText('$49/mo')).toBeVisible();
    await expect(
      page.getByText('Up to 25 members per workspace')
    ).toBeVisible();
    await expect(page.getByText('Email customer support')).toBeVisible();

    const proUpgradeButton = page.getByRole('button', {
      name: 'Upgrade to Pro',
    });
    await expect(proUpgradeButton).toBeVisible();
    await expect(proUpgradeButton).toBeEnabled();
  });

  // ── 4. Starter Annual toggle ──────────────────────────────────────────

  test('starter annual toggle changes price and shows bonus', async ({
    page,
    baseURL,
  }) => {
    await setupUserAndGoToBilling(page, baseURL!);

    // Find the Starter card's Annual toggle. Each upgrade card has its own toggle.
    // The first "Annual billing" toggle belongs to the Starter card.
    const starterAnnualToggle = page
      .getByRole('button', { name: 'Annual billing' })
      .first();
    await starterAnnualToggle.click();

    // Price should change to annual equivalent (~$4.17/mo).
    await expect(page.getByText('$4.17/mo')).toBeVisible();
    // Bonus feature should appear.
    await expect(page.getByText('2 months free').first()).toBeVisible();
  });

  // ── 5. Pro Annual toggle ──────────────────────────────────────────────

  test('pro annual toggle changes price and shows bonus', async ({
    page,
    baseURL,
  }) => {
    await setupUserAndGoToBilling(page, baseURL!);

    // The second "Annual billing" toggle belongs to the Pro card.
    const proAnnualToggle = page
      .getByRole('button', { name: 'Annual billing' })
      .nth(1);
    await proAnnualToggle.click();

    // Price should change to annual equivalent (~$40.83/mo).
    await expect(page.getByText('$40.83/mo')).toBeVisible();
    await expect(page.getByText('2 months free').first()).toBeVisible();
  });

  // ── 6. Starter Monthly toggle restores ────────────────────────────────

  test('starter monthly toggle restores original price', async ({
    page,
    baseURL,
  }) => {
    await setupUserAndGoToBilling(page, baseURL!);

    // Switch to Annual.
    const starterAnnualToggle = page
      .getByRole('button', { name: 'Annual billing' })
      .first();
    await starterAnnualToggle.click();
    await expect(page.getByText('$4.17/mo')).toBeVisible();
    await expect(page.getByText('2 months free').first()).toBeVisible();

    // Switch back to Monthly.
    const starterMonthlyToggle = page
      .getByRole('button', { name: 'Monthly billing' })
      .first();
    await starterMonthlyToggle.click();

    // Price should restore to $5/mo.
    await expect(page.getByText('$5/mo').first()).toBeVisible();
    // Annual price should disappear from the Starter card.
    await expect(page.getByText('$4.17/mo')).not.toBeVisible();
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

    const starterButton = page.getByRole('button', {
      name: 'Upgrade to Starter',
    });
    await starterButton.click();

    // Button text should change to "Redirecting...".
    await expect(page.getByText('Redirecting...')).toBeVisible();

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

    // Click upgrade to Starter.
    await page.getByRole('button', { name: 'Upgrade to Starter' }).click();

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
    await page.getByRole('button', { name: 'Upgrade to Starter' }).click();
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
    await page.getByRole('button', { name: 'Upgrade to Starter' }).click();
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
    await setupUserAndGoToBilling(page, baseURL!);

    // Toggle Pro to Annual.
    const proAnnualToggle = page
      .getByRole('button', { name: 'Annual billing' })
      .nth(1);
    await proAnnualToggle.click();
    await expect(page.getByText('$40.83/mo')).toBeVisible();

    // Click upgrade to Pro.
    await page.getByRole('button', { name: 'Upgrade to Pro' }).click();
    await completeStripeCheckout(page);

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
    await page.getByRole('button', { name: 'Upgrade to Starter' }).click();
    await completeStripeCheckout(page);
    await expect(page.getByText('Current plan')).toBeVisible({
      timeout: 15000,
    });

    // Open manage plan dialog.
    await page.getByRole('button', { name: 'Manage plan' }).click();

    // Dialog should show title and current plan description.
    await expect(
      page.getByRole('heading', { name: 'Manage your plan' }).nth(1)
    ).toBeVisible();
    await expect(page.getByText('Current plan: Starter')).toBeVisible();

    // All three plan columns should be visible: Free, Starter, Pro.
    const dialog = page.locator('[role="alertdialog"]');
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
    await page.getByRole('button', { name: 'Upgrade to Starter' }).click();
    await completeStripeCheckout(page);
    await expect(page.getByText('Current plan')).toBeVisible({
      timeout: 15000,
    });

    // Open manage plan dialog.
    await page.getByRole('button', { name: 'Manage plan' }).click();

    const dialog = page.locator('[role="alertdialog"]');

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
    await page.getByRole('button', { name: 'Upgrade to Starter' }).click();
    await completeStripeCheckout(page);
    await expect(page.getByText('Current plan')).toBeVisible({
      timeout: 15000,
    });

    // Open manage plan dialog.
    await page.getByRole('button', { name: 'Manage plan' }).click();
    await expect(
      page.getByRole('heading', { name: 'Manage your plan' }).nth(1)
    ).toBeVisible();

    // Close the dialog.
    const dialog = page.locator('[role="alertdialog"]');
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
    await page.getByRole('button', { name: 'Upgrade to Starter' }).click();
    await completeStripeCheckout(page);
    await expect(page.getByText('Current plan')).toBeVisible({
      timeout: 15000,
    });

    // Open manage plan dialog.
    await page.getByRole('button', { name: 'Manage plan' }).click();

    const manageDialog = page.locator('[role="alertdialog"]');

    // Click Downgrade on the Free plan column.
    // Free plan uses the "cancel" action, which has label "Downgrade".
    await manageDialog
      .getByRole('button', { name: 'Downgrade' })
      .first()
      .click();

    // Confirm dialog should appear.
    await expect(page.getByText('Downgrade to Free?')).toBeVisible();
    // Feature diff should show member limit change.
    await expect(page.getByText(/Member limit drops from 5 → 1/)).toBeVisible();

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
    await page.getByRole('button', { name: 'Upgrade to Starter' }).click();
    await completeStripeCheckout(page);
    await expect(page.getByText('Current plan')).toBeVisible({
      timeout: 15000,
    });

    // Open manage plan, downgrade to Free, confirm.
    await page.getByRole('button', { name: 'Manage plan' }).click();
    const manageDialog = page.locator('[role="alertdialog"]');
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
    await page.getByRole('button', { name: 'Upgrade to Starter' }).click();
    await completeStripeCheckout(page);
    await expect(page.getByText('Current plan')).toBeVisible({
      timeout: 15000,
    });

    // Cancel: open manage plan, downgrade to Free, confirm.
    await page.getByRole('button', { name: 'Manage plan' }).click();
    const manageDialog = page.locator('[role="alertdialog"]');
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
    await setupUserAndGoToBilling(page, baseURL!);

    // Upgrade to Pro.
    await page.getByRole('button', { name: 'Upgrade to Pro' }).click();
    await completeStripeCheckout(page);
    await expect(page.getByText('Current plan')).toBeVisible({
      timeout: 15000,
    });
    await expect(
      page.locator('[data-slot="card-title"]').getByText('Pro')
    ).toBeVisible();

    // Open manage plan.
    await page.getByRole('button', { name: 'Manage plan' }).click();

    const manageDialog = page.locator('[role="alertdialog"]');

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
      page.getByText(/Member limit drops from 25 → 5/)
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
    await page.getByRole('button', { name: 'Upgrade to Starter' }).click();
    await completeStripeCheckout(page);
    await expect(page.getByText('Current plan')).toBeVisible({
      timeout: 15000,
    });

    // Cancel: open manage plan, downgrade to Free, confirm.
    await page.getByRole('button', { name: 'Manage plan' }).click();
    let manageDialog = page.locator('[role="alertdialog"]');
    await manageDialog
      .getByRole('button', { name: 'Downgrade' })
      .first()
      .click();
    await page.getByRole('button', { name: 'Confirm downgrade' }).click();
    await expect(
      page.getByText('Subscription will cancel at period end.')
    ).toBeVisible({ timeout: 10000 });

    // Reopen manage plan dialog.
    await page.getByRole('button', { name: 'Manage plan' }).click();

    manageDialog = page.locator('[role="alertdialog"]');

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

  test.fixme('member count exceeds limit shows warning in downgrade dialog', async () => {
    // Requires a multi-member workspace to test the member count warning
    // in the downgrade confirmation dialog.
  });

  // ── 23. Billing portal navigates to Stripe ────────────────────────────

  test('billing portal navigates to stripe', async ({ page, baseURL }) => {
    await setupUserAndGoToBilling(page, baseURL!);

    // Upgrade to Starter.
    await page.getByRole('button', { name: 'Upgrade to Starter' }).click();
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

  // ── 25. Non-owner cannot access billing ───────────────────────────────

  test.fixme('non-owner member cannot access billing page', async () => {
    // Requires invite flow to add a non-owner member to the workspace
    // and verify they cannot access the billing page.
  });

  // ── 26. Concurrent upgrade button lockout ─────────────────────────────

  test('concurrent upgrade buttons are locked out during redirect', async ({
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

    // Click "Upgrade to Starter" — should show "Redirecting..." and disable Pro button.
    await page.getByRole('button', { name: 'Upgrade to Starter' }).click();

    // The Starter button should show "Redirecting...".
    await expect(page.getByText('Redirecting...')).toBeVisible();

    // The Pro upgrade button should be disabled during the redirect.
    const proButton = page.getByRole('button', { name: 'Upgrade to Pro' });
    await expect(proButton).toBeDisabled();
  });
});
