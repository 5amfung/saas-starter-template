import { describe, expect, it } from 'vitest';
import {
  OPERATIONS,
  buildWorkflowAttributes,
  redactAuthWorkflowAttributes,
} from '@/observability/client';

describe('observability helpers', () => {
  it('builds stable workflow attributes', () => {
    expect(
      buildWorkflowAttributes(OPERATIONS.BILLING_CHECKOUT_CREATE_SESSION, {
        workspaceId: 'ws_123',
        route: '/ws/$workspaceId/billing',
        result: 'success',
      })
    ).toEqual({
      operation: 'billing.checkout.create_session',
      operationFamily: 'billing',
      route: '/ws/$workspaceId/billing',
      result: 'success',
      workspaceId: 'ws_123',
    });
  });

  it('redacts auth-sensitive values', () => {
    expect(
      redactAuthWorkflowAttributes({
        email: 'person@example.com',
        token: 'secret-token',
        userId: 'user_123',
      })
    ).toEqual({
      userId: 'user_123',
    });
  });
});
