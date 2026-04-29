import type { WorkflowOperation, WorkflowOperationFamily } from './operations';

export type WorkflowResult = 'attempt' | 'success' | 'failure';

export type WorkflowAttributes = {
  route?: string;
  userId?: string;
  workspaceId?: string;
  targetUserId?: string;
  planId?: string;
  memberRole?: string;
  failureCategory?: string;
  result?: WorkflowResult;
};

export type WorkflowAttributesShape = WorkflowAttributes & {
  operation: WorkflowOperation;
  operationFamily: WorkflowOperationFamily;
};

export type BrowserSentryRuntimeEnv = {
  MODE?: string;
  VITEST?: boolean;
  VITE_SENTRY_DISABLED?: string;
  VITE_SENTRY_DSN?: string;
};

const AUTH_REDACTED_KEYS = new Set([
  'accessToken',
  'authorization',
  'code',
  'email',
  'inviteToken',
  'password',
  'refreshToken',
  'secret',
  'sessionToken',
  'token',
  'verificationCode',
]);

export function getWorkflowOperationFamily(
  operation: WorkflowOperation
): WorkflowOperationFamily {
  return operation.split('.')[0] as WorkflowOperationFamily;
}

export function buildWorkflowAttributes(
  operation: WorkflowOperation,
  attributes: WorkflowAttributes = {}
): WorkflowAttributesShape {
  return {
    operation,
    operationFamily: getWorkflowOperationFamily(operation),
    ...attributes,
  };
}

export function redactAuthWorkflowAttributes(
  attributes: Record<string, unknown>
): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(attributes).filter(([key, value]) => {
      if (value === undefined) {
        return false;
      }

      return !AUTH_REDACTED_KEYS.has(key);
    })
  );
}

export function isBrowserSentryRuntimeEnabled(
  env: BrowserSentryRuntimeEnv
): boolean {
  return (
    !env.VITEST && env.MODE !== 'test' && env.VITE_SENTRY_DISABLED !== 'true'
  );
}

export function getBrowserSentryTunnel(
  env: BrowserSentryRuntimeEnv
): string | undefined {
  if (!env.VITE_SENTRY_DSN?.trim()) {
    return undefined;
  }

  return '/api/tunnel';
}
