import { expect, test } from '@playwright/test';
import { createIsolatedWorkspaceFixture } from '@workspace/test-utils';
import { parseCookieHeader } from '../lib/parse-cookie-header';
import type { Page } from '@playwright/test';

async function loginToWorkspaceIntegrations(
  page: Page,
  baseURL: string
): Promise<Awaited<ReturnType<typeof createIsolatedWorkspaceFixture>>> {
  const fixture = await createIsolatedWorkspaceFixture(baseURL, {
    plan: 'starter',
    emailPrefix: 'integrations-owner',
  });

  await page
    .context()
    .addCookies(
      parseCookieHeader(fixture.owner.cookie, new URL(baseURL).hostname)
    );

  await page.goto(`/ws/${fixture.workspace.id}/integrations`, {
    waitUntil: 'domcontentloaded',
  });
  await page.waitForURL(`**/ws/${fixture.workspace.id}/integrations`, {
    timeout: 15000,
    waitUntil: 'domcontentloaded',
  });
  await expect(page.getByRole('heading', { name: 'Integrations' })).toBeVisible(
    {
      timeout: 15000,
    }
  );

  return fixture;
}

function maskPattern(prefix: string) {
  return new RegExp(`^${prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\*+$`);
}

test.describe('Workspace — Integrations', () => {
  test('saves a client ID, re-masks it, and persists across reload', async ({
    page,
    baseURL,
  }) => {
    await loginToWorkspaceIntegrations(page, baseURL!);

    const clientIdInput = page.getByRole('textbox', { name: 'Client ID' });
    const saveButton = page.getByRole('button', { name: 'Save Client ID' });
    const cancelButton = page.getByRole('button', { name: 'Cancel Client ID' });

    await expect(saveButton).toBeDisabled();
    await expect(cancelButton).toBeDisabled();

    await clientIdInput.fill('slack-client-12345');
    await expect(saveButton).toBeEnabled();
    await expect(cancelButton).toBeEnabled();

    await saveButton.click();

    await expect(page.getByText('Client ID saved.')).toBeVisible({
      timeout: 10000,
    });
    await expect(clientIdInput).toHaveValue(maskPattern('slack-'));
    await expect(saveButton).toBeDisabled();
    await expect(cancelButton).toBeDisabled();

    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(
      page.getByRole('heading', { name: 'Integrations' })
    ).toBeVisible();
    await expect(clientIdInput).toHaveValue(maskPattern('slack-'));
    await expect(saveButton).toBeDisabled();
    await expect(cancelButton).toBeDisabled();
  });

  test('reveals and hides locally, and cancel restores the masked saved value', async ({
    page,
    baseURL,
  }) => {
    await loginToWorkspaceIntegrations(page, baseURL!);

    const clientIdInput = page.getByRole('textbox', { name: 'Client ID' });
    const saveButton = page.getByRole('button', { name: 'Save Client ID' });
    const cancelButton = page.getByRole('button', { name: 'Cancel Client ID' });

    await clientIdInput.fill('slack-client-98765');
    await saveButton.click();
    await expect(page.getByText('Client ID saved.')).toBeVisible({
      timeout: 10000,
    });
    await expect(clientIdInput).toHaveValue(maskPattern('slack-'));

    const revealButton = page.getByRole('button', { name: 'Reveal Client ID' });
    await revealButton.click();
    await expect(clientIdInput).toHaveValue('slack-client-98765');
    await expect(
      page.getByRole('button', { name: 'Hide Client ID' })
    ).toBeVisible();

    await page.getByRole('button', { name: 'Hide Client ID' }).click();
    await expect(clientIdInput).toHaveValue(maskPattern('slack-'));
    await expect(revealButton).toBeVisible();

    await revealButton.click();
    await expect(clientIdInput).toHaveValue('slack-client-98765');
    await clientIdInput.fill('temporary-client-id');
    await expect(saveButton).toBeEnabled();
    await expect(cancelButton).toBeEnabled();

    await cancelButton.click();
    await expect(clientIdInput).toHaveValue(maskPattern('slack-'));
    await expect(saveButton).toBeDisabled();
    await expect(cancelButton).toBeDisabled();
    await expect(
      page.getByRole('button', { name: 'Reveal Client ID' })
    ).toBeVisible();
  });
});
