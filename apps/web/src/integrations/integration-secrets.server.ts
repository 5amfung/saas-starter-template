import {
  getWorkspaceIntegrationSummaries,
  revealWorkspaceIntegrationValue as revealWorkspaceIntegrationValueFromPackage,
  updateWorkspaceIntegrationValues as updateWorkspaceIntegrationValuesFromPackage,
} from '@workspace/integrations';
import { getWorkspaceIntegrationEncryptionKey } from './integration-encryption-key.server';
import type {
  IntegrationFieldKey,
  IntegrationKey,
} from '@workspace/integrations';
import { getDb } from '@/init';
import { requireWorkspaceCapabilityForUser } from '@/policy/workspace-capabilities.server';

async function requireIntegrationCapability(
  headers: Headers,
  workspaceId: string,
  userId: string,
  capability: 'canViewIntegrations' | 'canManageIntegrations'
) {
  return requireWorkspaceCapabilityForUser(
    headers,
    workspaceId,
    userId,
    capability
  );
}

export async function getWorkspaceIntegrationsSummary(
  headers: Headers,
  workspaceId: string,
  userId: string
) {
  const capabilities = await requireIntegrationCapability(
    headers,
    workspaceId,
    userId,
    'canViewIntegrations'
  );

  return getWorkspaceIntegrationSummaries({
    db: getDb(),
    encryptionKey: getWorkspaceIntegrationEncryptionKey(),
    includeValues: capabilities.canManageIntegrations,
    workspaceId,
  });
}

export async function revealWorkspaceIntegrationSecretValue(
  headers: Headers,
  workspaceId: string,
  userId: string,
  integration: IntegrationKey,
  key: IntegrationFieldKey
) {
  await requireIntegrationCapability(
    headers,
    workspaceId,
    userId,
    'canManageIntegrations'
  );

  return revealWorkspaceIntegrationValueFromPackage({
    db: getDb(),
    encryptionKey: getWorkspaceIntegrationEncryptionKey(),
    workspaceId,
    integration,
    key,
  });
}

export async function updateWorkspaceIntegrationSecretValues(
  headers: Headers,
  workspaceId: string,
  userId: string,
  integration: IntegrationKey,
  values: Array<{ key: IntegrationFieldKey; value: string }>
) {
  await requireIntegrationCapability(
    headers,
    workspaceId,
    userId,
    'canManageIntegrations'
  );

  return updateWorkspaceIntegrationValuesFromPackage({
    db: getDb(),
    encryptionKey: getWorkspaceIntegrationEncryptionKey(),
    workspaceId,
    integration,
    values,
  });
}
