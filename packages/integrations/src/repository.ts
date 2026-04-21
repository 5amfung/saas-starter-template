import { and, eq } from 'drizzle-orm';
import { integrationSecrets } from '@workspace/db-schema';
import type { Database } from '@workspace/db';
import type { IntegrationFieldKey, IntegrationKey } from './definitions';
import type { EncryptedIntegrationSecret } from './types';

export interface WorkspaceIntegrationSecretRow extends EncryptedIntegrationSecret {
  integration: IntegrationKey;
  key: IntegrationFieldKey;
}

type WorkspaceIntegrationsDb = Pick<
  Database,
  'select' | 'insert' | 'delete' | 'transaction'
>;

export async function listWorkspaceIntegrationSecretRows(
  db: WorkspaceIntegrationsDb,
  workspaceId: string
): Promise<Array<WorkspaceIntegrationSecretRow>> {
  return db
    .select({
      integration: integrationSecrets.integration,
      key: integrationSecrets.key,
      encryptedValue: integrationSecrets.encryptedValue,
      iv: integrationSecrets.iv,
      authTag: integrationSecrets.authTag,
      encryptionVersion: integrationSecrets.encryptionVersion,
    })
    .from(integrationSecrets)
    .where(eq(integrationSecrets.workspaceId, workspaceId)) as Promise<
    Array<WorkspaceIntegrationSecretRow>
  >;
}

export async function getWorkspaceIntegrationSecretRow(
  db: WorkspaceIntegrationsDb,
  workspaceId: string,
  integration: IntegrationKey,
  key: IntegrationFieldKey
): Promise<WorkspaceIntegrationSecretRow | null> {
  const rows = await db
    .select({
      integration: integrationSecrets.integration,
      key: integrationSecrets.key,
      encryptedValue: integrationSecrets.encryptedValue,
      iv: integrationSecrets.iv,
      authTag: integrationSecrets.authTag,
      encryptionVersion: integrationSecrets.encryptionVersion,
    })
    .from(integrationSecrets)
    .where(
      and(
        eq(integrationSecrets.workspaceId, workspaceId),
        eq(integrationSecrets.integration, integration),
        eq(integrationSecrets.key, key)
      )
    )
    .limit(1);

  return (rows.at(0) as WorkspaceIntegrationSecretRow | undefined) ?? null;
}

export async function upsertWorkspaceIntegrationSecretRow(
  db: WorkspaceIntegrationsDb,
  row: {
    id: string;
    workspaceId: string;
    integration: IntegrationKey;
    key: IntegrationFieldKey;
    encryptedValue: string;
    iv: string;
    authTag: string;
    encryptionVersion: number;
  }
) {
  await db
    .insert(integrationSecrets)
    .values(row)
    .onConflictDoUpdate({
      target: [
        integrationSecrets.workspaceId,
        integrationSecrets.integration,
        integrationSecrets.key,
      ],
      set: {
        encryptedValue: row.encryptedValue,
        iv: row.iv,
        authTag: row.authTag,
        encryptionVersion: row.encryptionVersion,
        updatedAt: new Date(),
      },
    });
}

export async function deleteWorkspaceIntegrationSecretRow(
  db: WorkspaceIntegrationsDb,
  workspaceId: string,
  integration: IntegrationKey,
  key: IntegrationFieldKey
) {
  await db
    .delete(integrationSecrets)
    .where(
      and(
        eq(integrationSecrets.workspaceId, workspaceId),
        eq(integrationSecrets.integration, integration),
        eq(integrationSecrets.key, key)
      )
    );
}
