import { randomUUID } from 'node:crypto';
import { INTEGRATION_DEFINITIONS, isIntegrationFieldKey } from './definitions';
import {
  decryptIntegrationSecret,
  encryptIntegrationSecret,
  maskIntegrationSecret,
} from './crypto';
import {
  deleteWorkspaceIntegrationSecretRow,
  getWorkspaceIntegrationSecretRow,
  listWorkspaceIntegrationSecretRows,
  upsertWorkspaceIntegrationSecretRow,
} from './repository';
import type { IntegrationFieldKey, IntegrationKey } from './definitions';
import type { Database } from '@workspace/db';
import type { WorkspaceIntegrationSummary } from './types';

type WorkspaceIntegrationsDb = Pick<
  Database,
  'select' | 'insert' | 'delete' | 'transaction'
>;

type WorkspaceIntegrationValueInput = {
  key: IntegrationFieldKey;
  value: string;
};

type BaseInput = {
  db: WorkspaceIntegrationsDb;
  encryptionKey: string;
  workspaceId: string;
};

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

function toSummaries(
  workspaceSecretRows: Array<{
    integration: IntegrationKey;
    key: IntegrationFieldKey;
    encryptedValue: string;
    iv: string;
    authTag: string;
    encryptionVersion: number;
  }>,
  encryptionKey: string,
  includeValues = false
): Array<WorkspaceIntegrationSummary> {
  const rowByField = new Map(
    workspaceSecretRows.map(
      (row) => [`${row.integration}:${row.key}`, row] as const
    )
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
          value: null,
        };
      }

      const plaintext = decryptIntegrationSecret(row, encryptionKey);
      return {
        key: field.key,
        label: field.label,
        hasValue: true,
        maskedValue: maskIntegrationSecret(plaintext),
        value: includeValues ? plaintext : null,
      };
    }),
  }));
}

export async function getWorkspaceIntegrationSummaries({
  db,
  encryptionKey,
  workspaceId,
  includeValues = false,
}: BaseInput & {
  includeValues?: boolean;
}): Promise<Array<WorkspaceIntegrationSummary>> {
  const rows = await listWorkspaceIntegrationSecretRows(db, workspaceId);
  return toSummaries(rows, encryptionKey, includeValues);
}

export async function revealWorkspaceIntegrationValue({
  db,
  encryptionKey,
  workspaceId,
  integration,
  key,
}: BaseInput & {
  integration: IntegrationKey;
  key: IntegrationFieldKey;
}): Promise<{ value: string | null }> {
  assertSupportedIntegrationField(integration, key);
  const row = await getWorkspaceIntegrationSecretRow(
    db,
    workspaceId,
    integration,
    key
  );

  if (!row) {
    return { value: null };
  }

  return { value: decryptIntegrationSecret(row, encryptionKey) };
}

export async function updateWorkspaceIntegrationValues({
  db,
  encryptionKey,
  workspaceId,
  integration,
  values,
}: BaseInput & {
  integration: IntegrationKey;
  values: Array<WorkspaceIntegrationValueInput>;
}): Promise<Array<WorkspaceIntegrationSummary>> {
  const latestValueByKey = new Map<IntegrationFieldKey, string>();

  for (const entry of values) {
    assertSupportedIntegrationField(integration, entry.key);
    latestValueByKey.set(entry.key, entry.value.trim());
  }

  await db.transaction(async (tx) => {
    for (const [key, value] of latestValueByKey) {
      if (!value) {
        await deleteWorkspaceIntegrationSecretRow(
          tx,
          workspaceId,
          integration,
          key
        );
        continue;
      }

      const encrypted = encryptIntegrationSecret(value, encryptionKey);
      await upsertWorkspaceIntegrationSecretRow(tx, {
        id: randomUUID(),
        workspaceId,
        integration,
        key,
        encryptedValue: encrypted.encryptedValue,
        iv: encrypted.iv,
        authTag: encrypted.authTag,
        encryptionVersion: encrypted.encryptionVersion,
      });
    }
  });

  return getWorkspaceIntegrationSummaries({
    db,
    encryptionKey,
    workspaceId,
    includeValues: true,
  });
}
