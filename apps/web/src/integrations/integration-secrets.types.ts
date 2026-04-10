import type {
  IntegrationFieldKey,
  IntegrationKey,
} from './integration-definitions';

export interface WorkspaceIntegrationFieldSummary {
  key: IntegrationFieldKey;
  label: string;
  hasValue: boolean;
  maskedValue: string | null;
}

export interface WorkspaceIntegrationSummary {
  integration: IntegrationKey;
  label: string;
  fields: Array<WorkspaceIntegrationFieldSummary>;
}
