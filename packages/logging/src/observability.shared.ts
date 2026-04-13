import {
  type WorkflowOperation,
  type WorkflowOperationFamily,
} from './operations';

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
  const safeAttributes = Object.fromEntries(
    Object.entries(attributes).filter(([, value]) => value !== undefined)
  ) as WorkflowAttributes;

  return {
    operation,
    operationFamily: getWorkflowOperationFamily(operation),
    ...safeAttributes,
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
