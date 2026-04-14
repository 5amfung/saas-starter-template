import { and, eq } from 'drizzle-orm';
import { workspaceIntegrationSecrets } from '@workspace/db-schema';
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
      integration: workspaceIntegrationSecrets.integration,
      key: workspaceIntegrationSecrets.key,
      encryptedValue: workspaceIntegrationSecrets.encryptedValue,
      iv: workspaceIntegrationSecrets.iv,
      authTag: workspaceIntegrationSecrets.authTag,
      encryptionVersion: workspaceIntegrationSecrets.encryptionVersion,
    })
    .from(workspaceIntegrationSecrets)
    .where(eq(workspaceIntegrationSecrets.workspaceId, workspaceId)) as Promise<
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
      integration: workspaceIntegrationSecrets.integration,
      key: workspaceIntegrationSecrets.key,
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
    .insert(workspaceIntegrationSecrets)
    .values(row)
    .onConflictDoUpdate({
      target: [
        workspaceIntegrationSecrets.workspaceId,
        workspaceIntegrationSecrets.integration,
        workspaceIntegrationSecrets.key,
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
    .delete(workspaceIntegrationSecrets)
    .where(
      and(
        eq(workspaceIntegrationSecrets.workspaceId, workspaceId),
        eq(workspaceIntegrationSecrets.integration, integration),
        eq(workspaceIntegrationSecrets.key, key)
      )
    );
}
