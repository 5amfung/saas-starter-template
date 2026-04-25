import type { IntegrationFieldKey, IntegrationKey } from './definitions';

export interface EncryptedIntegrationSecret {
  encryptedValue: string;
  iv: string;
  authTag: string;
  encryptionVersion: number;
}

export interface WorkspaceIntegrationFieldSummary {
  key: IntegrationFieldKey;
  label: string;
  hasValue: boolean;
  maskedValue: string | null;
  value: string | null;
}

export interface WorkspaceIntegrationSummary {
  integration: IntegrationKey;
  label: string;
  fields: Array<WorkspaceIntegrationFieldSummary>;
}
