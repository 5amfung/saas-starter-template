import { describe, expect, it } from 'vitest';
import {
  AUTH_OPERATIONS,
  BILLING_OPERATIONS,
  WORKSPACE_OPERATIONS,
} from '@workspace/logging/operations';
import {
  normalizeLogContext,
  normalizeLogPayload,
} from '@workspace/logging/request-context';

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

describe('normalizeLogPayload', () => {
  it('returns observability context only once for object payloads', () => {
    expect(
      normalizeLogPayload({
        route: '/api/auth/get-session',
        operation: 'GET /api/auth/get-session',
        statusCode: 200,
        durationMs: 56,
      })
    ).toEqual({
      route: '/api/auth/get-session',
      operation: 'GET /api/auth/get-session',
      statusCode: 200,
      durationMs: 56,
    });
  });

  it('wraps primitive payloads in a data field', () => {
    expect(normalizeLogPayload('hello')).toEqual({ data: 'hello' });
  });
});

describe('operation constants', () => {
  it('exports the full auth workflow operation contract', () => {
    expect(AUTH_OPERATIONS).toEqual({
      signInStarted: 'auth.sign_in.started',
      signInFailed: 'auth.sign_in.failed',
      passwordResetRequested: 'auth.password_reset.requested',
      invitationAccepted: 'auth.invitation.accepted',
    });
  });

  it('exports the full billing workflow operation contract', () => {
    expect(BILLING_OPERATIONS).toEqual({
      checkoutStarted: 'billing.checkout.started',
      checkoutCompleted: 'billing.checkout.completed',
      portalOpened: 'billing.portal.opened',
      subscriptionUpdated: 'billing.subscription.updated',
    });
  });

  it('exports the full workspace workflow operation contract', () => {
    expect(WORKSPACE_OPERATIONS).toEqual({
      memberInvited: 'workspace.member.invited',
      memberRemoved: 'workspace.member.removed',
      ownershipTransferred: 'workspace.ownership.transferred',
      settingsUpdated: 'workspace.settings.updated',
    });
  });
});
