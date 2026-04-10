import { describe, expect, it } from 'vitest';
import { normalizeLogContext } from '@workspace/logging/request-context';

describe('normalizeLogContext', () => {
  it('keeps only defined observability fields', () => {
    expect(
      normalizeLogContext({
        requestId: 'req_123',
        route: '/api/auth/sign-in',
        userId: undefined,
        workspaceId: 'ws_123',
      })
    ).toEqual({
      requestId: 'req_123',
      route: '/api/auth/sign-in',
      workspaceId: 'ws_123',
    });
  });
});
