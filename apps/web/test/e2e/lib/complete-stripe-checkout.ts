import { expect } from '@playwright/test';
import { STRIPE_TEST_CARD } from '@workspace/test-utils';
import type { Page } from '@playwright/test';

type CompleteStripeCheckoutOptions = {
  redirectPattern?: RegExp;
};

async function waitForRedirect(
  page: Page,
  redirectPattern: RegExp,
  timeout = 60000
): Promise<boolean> {
  return page
    .waitForURL(redirectPattern, { timeout, waitUntil: 'domcontentloaded' })
    .then(() => true)
    .catch(() => false);
}

async function enterLinkVerificationCode(page: Page): Promise<void> {
  const firstCodeInput = getFirstLinkCodeInput(page);
  await expect(firstCodeInput).toBeVisible({ timeout: 10000 });
  await firstCodeInput.click();
  await page.keyboard.type('000000');
}

function getFirstLinkCodeInput(page: Page) {
  return page.getByRole('textbox', {
    name: /one-time-code-input-0|security code character 1/i,
  });
}

async function dismissLinkDialogIfPossible(page: Page): Promise<boolean> {
  const linkDialog = page.getByRole('dialog');
  const closeBtn = linkDialog.locator('button').first();
  const dismissible = await closeBtn.isVisible().catch(() => false);

  if (!dismissible) {
    return false;
  }

  await closeBtn.click();
  await expect(linkDialog).not.toBeVisible({ timeout: 5000 });
  return true;
}

async function optOutOfLinkIfPossible(page: Page): Promise<boolean> {
  const payWithoutLinkButton = page.getByRole('button', {
    name: 'Pay without Link',
  });
  const canOptOut = await payWithoutLinkButton.isVisible().catch(() => false);

  if (!canOptOut) {
    return false;
  }

  await payWithoutLinkButton.click();
  await payWithoutLinkButton
    .waitFor({ state: 'hidden', timeout: 10000 })
    .catch(() => undefined);
  return true;
}

export async function completeStripeCheckout(
  page: Page,
  options: CompleteStripeCheckoutOptions = {}
): Promise<void> {
  const { redirectPattern = /localhost/ } = options;

  await page.waitForURL(/stripe\.com/, { timeout: 30000 });

  const confirmButton = page.getByRole('button', { name: 'Confirm' });
  const emailField = page.getByRole('textbox', { name: 'Email' });
  const firstCodeInput = getFirstLinkCodeInput(page);
  const subscribeButton = page.getByRole('button', { name: /subscribe/i });

  await Promise.race([
    confirmButton.waitFor({ state: 'visible', timeout: 15000 }),
    emailField.waitFor({ state: 'visible', timeout: 15000 }),
    firstCodeInput.waitFor({ state: 'visible', timeout: 15000 }),
  ]).catch(() => undefined);

  await optOutOfLinkIfPossible(page);

  if (await confirmButton.isVisible().catch(() => false)) {
    await confirmButton.click();
    await page.waitForURL(redirectPattern, {
      timeout: 60000,
      waitUntil: 'domcontentloaded',
    });
    return;
  }

  if (await firstCodeInput.isVisible().catch(() => false)) {
    const dismissed = await dismissLinkDialogIfPossible(page);
    if (!dismissed) {
      await enterLinkVerificationCode(page);
      if (await waitForRedirect(page, redirectPattern, 10000)) {
        return;
      }
    }
  }

  await expect(emailField).toBeVisible({ timeout: 10000 });
  await emailField.fill(STRIPE_TEST_CARD.email);

  const linkDialog = page.getByRole('dialog');
  const dialogAppeared = await linkDialog
    .waitFor({ state: 'visible', timeout: 5000 })
    .then(() => true)
    .catch(() => false);

  if (dialogAppeared) {
    if (await firstCodeInput.isVisible().catch(() => false)) {
      const dismissed = await dismissLinkDialogIfPossible(page);
      if (!dismissed) {
        await enterLinkVerificationCode(page);
        if (await waitForRedirect(page, redirectPattern, 10000)) {
          return;
        }
      }
    } else {
      const closeBtn = linkDialog.locator('button').first();
      await closeBtn.click();
      await expect(linkDialog).not.toBeVisible({ timeout: 5000 });
    }
  }

  await optOutOfLinkIfPossible(page);

  const cardRadio = page.getByRole('radio', { name: 'Card' });
  await cardRadio.click({ force: true });

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

  await subscribeButton.click();

  if (await waitForRedirect(page, redirectPattern, 10000)) {
    return;
  }

  const verificationRequired = await firstCodeInput
    .waitFor({ state: 'visible', timeout: 5000 })
    .then(() => true)
    .catch(() => false);

  if (verificationRequired) {
    const dismissed = await dismissLinkDialogIfPossible(page);
    if (!dismissed) {
      await enterLinkVerificationCode(page);
      if (await waitForRedirect(page, redirectPattern, 10000)) {
        return;
      }
    } else if (await optOutOfLinkIfPossible(page)) {
      await subscribeButton.click();
    }
  }

  await page.waitForURL(redirectPattern, {
    timeout: 60000,
    waitUntil: 'domcontentloaded',
  });
}
