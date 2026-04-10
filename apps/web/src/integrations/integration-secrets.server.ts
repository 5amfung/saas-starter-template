import crypto from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import {
  INTEGRATION_DEFINITIONS,
  isIntegrationFieldKey,
  type IntegrationFieldKey,
  type IntegrationKey,
} from './integration-definitions';
import type { WorkspaceIntegrationSummary } from './integration-secrets.types';
import {
  decryptIntegrationSecret,
  encryptIntegrationSecret,
  maskIntegrationSecret,
} from './integration-crypto.server';
import { getDb, workspaceIntegrationSecrets } from '@/init';
import { requireWorkspaceCapabilityForUser } from '@/policy/workspace-capabilities.server';

interface WorkspaceIntegrationSecretRow {
  integration: string;
  key: string;
  encryptedValue: string;
  iv: string;
  authTag: string;
  encryptionVersion: number;
}

type DbClient = ReturnType<typeof getDb>;

function assertSupportedIntegrationField(
  integration: IntegrationKey,
  key: string
): asserts key is IntegrationFieldKey {
  const definition = INTEGRATION_DEFINITIONS[integration];
  const isKnownKey =
    isIntegrationFieldKey(key) &&
    definition.fields.some((field) => field.key === key);

  if (!isKnownKey) {
    throw new Error(
      `Unsupported integration field "${key}" for integration "${integration}".`
    );
  }
}

async function listWorkspaceSecretRows(db: DbClient, workspaceId: string) {
  return (await db
    .select({
      integration: workspaceIntegrationSecrets.integration,
      key: workspaceIntegrationSecrets.key,
      encryptedValue: workspaceIntegrationSecrets.encryptedValue,
      iv: workspaceIntegrationSecrets.iv,
      authTag: workspaceIntegrationSecrets.authTag,
      encryptionVersion: workspaceIntegrationSecrets.encryptionVersion,
    })
    .from(workspaceIntegrationSecrets)
    .where(
      eq(workspaceIntegrationSecrets.workspaceId, workspaceId)
    )) as Array<WorkspaceIntegrationSecretRow>;
}

async function buildWorkspaceIntegrationSummaries(
  workspaceId: string,
  db: DbClient = getDb()
): Promise<Array<WorkspaceIntegrationSummary>> {
  const rows = await listWorkspaceSecretRows(db, workspaceId);
  const rowByField = new Map(
    rows.map((row) => [`${row.integration}:${row.key}`, row] as const)
  );

  return (
    Object.entries(INTEGRATION_DEFINITIONS) as Array<
      [IntegrationKey, (typeof INTEGRATION_DEFINITIONS)[IntegrationKey]]
    >
  ).map(([integration, definition]) => ({
    integration,
    label: definition.label,
    fields: definition.fields.map((field) => {
      const row = rowByField.get(`${integration}:${field.key}`);
      if (!row) {
        return {
          key: field.key,
          label: field.label,
          hasValue: false,
          maskedValue: null,
        };
      }

      // The UI intentionally shows the first six characters, so summaries must
      // decrypt server-side before masking instead of relying on ciphertext-only
      // metadata.
      const plaintext = decryptIntegrationSecret(row);
      return {
        key: field.key,
        label: field.label,
        hasValue: true,
        maskedValue: maskIntegrationSecret(plaintext),
      };
    }),
  }));
}

export async function getWorkspaceIntegrationsSummary(
  headers: Headers,
  workspaceId: string,
  userId: string
): Promise<Array<WorkspaceIntegrationSummary>> {
  await requireWorkspaceCapabilityForUser(
    headers,
    workspaceId,
    userId,
    'canViewIntegrations'
  );

  return buildWorkspaceIntegrationSummaries(workspaceId);
}

export async function revealWorkspaceIntegrationSecretValue(
  headers: Headers,
  workspaceId: string,
  userId: string,
  integration: IntegrationKey,
  key: IntegrationFieldKey
) {
  assertSupportedIntegrationField(integration, key);

  await requireWorkspaceCapabilityForUser(
    headers,
    workspaceId,
    userId,
    'canManageIntegrations'
  );

  const row = (
    await getDb()
      .select({
        encryptedValue: workspaceIntegrationSecrets.encryptedValue,
        iv: workspaceIntegrationSecrets.iv,
        authTag: workspaceIntegrationSecrets.authTag,
        encryptionVersion: workspaceIntegrationSecrets.encryptionVersion,
      })
      .from(workspaceIntegrationSecrets)
      .where(
        and(
          eq(workspaceIntegrationSecrets.workspaceId, workspaceId),
          eq(workspaceIntegrationSecrets.integration, integration),
          eq(workspaceIntegrationSecrets.key, key)
        )
      )
      .limit(1)
  ).at(0);

  if (!row) {
    return { value: null };
  }

  return { value: decryptIntegrationSecret(row) };
}

export async function updateWorkspaceIntegrationSecretValues(
  headers: Headers,
  workspaceId: string,
  userId: string,
  integration: IntegrationKey,
  values: Array<{ key: IntegrationFieldKey; value: string }>
) {
  await requireWorkspaceCapabilityForUser(
    headers,
    workspaceId,
    userId,
    'canManageIntegrations'
  );

  const latestValueByKey = new Map<IntegrationFieldKey, string>();
  for (const entry of values) {
    assertSupportedIntegrationField(integration, entry.key);
    latestValueByKey.set(entry.key, entry.value.trim());
  }

  const db = getDb();

  await db.transaction(async (tx) => {
    for (const [key, value] of latestValueByKey) {
      if (!value) {
        await tx
          .delete(workspaceIntegrationSecrets)
          .where(
            and(
              eq(workspaceIntegrationSecrets.workspaceId, workspaceId),
              eq(workspaceIntegrationSecrets.integration, integration),
              eq(workspaceIntegrationSecrets.key, key)
            )
          );
        continue;
      }

      const encrypted = encryptIntegrationSecret(value);
      await tx
        .insert(workspaceIntegrationSecrets)
        .values({
          id: crypto.randomUUID(),
          workspaceId,
          integration,
          key,
          encryptedValue: encrypted.encryptedValue,
          iv: encrypted.iv,
          authTag: encrypted.authTag,
          encryptionVersion: encrypted.encryptionVersion,
        })
        .onConflictDoUpdate({
          target: [
            workspaceIntegrationSecrets.workspaceId,
            workspaceIntegrationSecrets.integration,
            workspaceIntegrationSecrets.key,
          ],
          set: {
            encryptedValue: encrypted.encryptedValue,
            iv: encrypted.iv,
            authTag: encrypted.authTag,
            encryptionVersion: encrypted.encryptionVersion,
            updatedAt: new Date(),
          },
        });
    }
  });

  return buildWorkspaceIntegrationSummaries(workspaceId, db);
}
