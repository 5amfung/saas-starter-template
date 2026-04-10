import { describe, expect, it } from 'vitest';
import { normalizeLogContext } from '@workspace/logging/request-context';

describe('normalizeLogContext', () => {
  it('keeps only defined observability fields', () => {
    expect(
      normalizeLogContext({
        requestId: 'req_456',
        route: '/api/auth/sign-in',
        operation: undefined,
        workspaceId: 'ws_456',
      })
    ).toEqual({
      requestId: 'req_456',
      route: '/api/auth/sign-in',
      workspaceId: 'ws_456',
    });
  });
});
