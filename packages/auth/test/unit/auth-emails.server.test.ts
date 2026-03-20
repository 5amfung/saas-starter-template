import { createElement } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { sendEmailMock, buildEmailRequestContextMock, getRequestHeadersMock } =
  vi.hoisted(() => ({
    sendEmailMock: vi.fn(),
    buildEmailRequestContextMock: vi.fn(),
    getRequestHeadersMock: vi.fn(),
  }));

vi.mock('@workspace/email', () => ({
  buildEmailRequestContext: buildEmailRequestContextMock,
}));

// Mock email template components to simple strings for assertion simplicity.
vi.mock('@workspace/email/templates/change-email-approval-email', () => ({
  ChangeEmailApprovalEmail: 'ChangeEmailApprovalEmail',
}));

vi.mock('@workspace/email/templates/email-verification-email', () => ({
  EmailVerificationEmail: 'EmailVerificationEmail',
}));

vi.mock('@workspace/email/templates/reset-password-email', () => ({
  ResetPasswordEmail: 'ResetPasswordEmail',
}));

vi.mock('@workspace/email/templates/workspace-invitation-email', () => ({
  WorkspaceInvitationEmail: 'WorkspaceInvitationEmail',
}));

// Lazily import the module under test after all mocks are registered.
const { createAuthEmails } = await import('../../src/auth-emails.server');

const MOCK_REQUEST_CONTEXT = {
  requestedAtUtc: '12 March 2026, 10:00 UTC',
  ip: '1.2.3.4',
};

const MOCK_HEADERS = new Headers();

const BASE_URL = 'http://localhost:3000';

function createTestEmails() {
  return createAuthEmails({
    emailClient: {
      sendEmail: sendEmailMock,
      config: {
        appName: 'TestApp',
        apiKey: 'test',
        fromEmail: 'test@test.com',
      },
    },
    getRequestHeaders: getRequestHeadersMock,
    baseUrl: BASE_URL,
  });
}

describe('auth-emails', () => {
  let emails: ReturnType<typeof createTestEmails>;

  beforeEach(() => {
    vi.clearAllMocks();
    getRequestHeadersMock.mockReturnValue(MOCK_HEADERS);
    buildEmailRequestContextMock.mockReturnValue(MOCK_REQUEST_CONTEXT);
    emails = createTestEmails();
  });

  describe('sendChangeEmailConfirmation', () => {
    it('sends email with correct parameters', async () => {
      await emails.sendChangeEmailConfirmation({
        user: { email: 'old@example.com' },
        newEmail: 'new@example.com',
        url: 'https://app.example.com/verify-change',
      });

      expect(buildEmailRequestContextMock).toHaveBeenCalledWith(MOCK_HEADERS);
      expect(sendEmailMock).toHaveBeenCalledOnce();
      expect(sendEmailMock).toHaveBeenCalledWith({
        to: 'old@example.com',
        subject: 'Approve your email change',
        react: createElement('ChangeEmailApprovalEmail', {
          appName: 'TestApp',
          newEmail: 'new@example.com',
          approvalUrl: 'https://app.example.com/verify-change',
          requestContext: MOCK_REQUEST_CONTEXT,
        }),
      });
    });
  });

  describe('sendResetPasswordEmail', () => {
    it('sends email with correct parameters', async () => {
      await emails.sendResetPasswordEmail({
        user: { email: 'user@example.com' },
        url: 'https://app.example.com/reset',
      });

      expect(buildEmailRequestContextMock).toHaveBeenCalledWith(MOCK_HEADERS);
      expect(sendEmailMock).toHaveBeenCalledOnce();
      expect(sendEmailMock).toHaveBeenCalledWith({
        to: 'user@example.com',
        subject: 'Reset your password',
        react: createElement('ResetPasswordEmail', {
          appName: 'TestApp',
          resetUrl: 'https://app.example.com/reset',
          requestContext: MOCK_REQUEST_CONTEXT,
        }),
      });
    });
  });

  describe('sendVerificationEmail', () => {
    it('sends email with correct parameters', async () => {
      await emails.sendVerificationEmail({
        user: { email: 'user@example.com' },
        url: 'https://app.example.com/verify',
      });

      expect(buildEmailRequestContextMock).toHaveBeenCalledWith(MOCK_HEADERS);
      expect(sendEmailMock).toHaveBeenCalledOnce();
      expect(sendEmailMock).toHaveBeenCalledWith({
        to: 'user@example.com',
        subject: 'Verify your email address',
        react: createElement('EmailVerificationEmail', {
          appName: 'TestApp',
          verificationUrl: 'https://app.example.com/verify',
          requestContext: MOCK_REQUEST_CONTEXT,
        }),
      });
    });
  });

  describe('sendInvitationEmail', () => {
    it('sends email with correct parameters', async () => {
      await emails.sendInvitationEmail({
        email: 'invitee@example.com',
        id: 'inv_456',
        organization: { name: 'Acme Corp' },
        inviter: { user: { email: 'boss@example.com' } },
      });

      expect(sendEmailMock).toHaveBeenCalledOnce();
      expect(sendEmailMock).toHaveBeenCalledWith({
        to: 'invitee@example.com',
        subject: 'Join Acme Corp on TestApp',
        react: createElement('WorkspaceInvitationEmail', {
          appName: 'TestApp',
          workspaceName: 'Acme Corp',
          inviterEmail: 'boss@example.com',
          invitationUrl: 'http://localhost:3000/accept-invite?id=inv_456',
        }),
      });
    });

    it('does not call buildEmailRequestContext', async () => {
      await emails.sendInvitationEmail({
        email: 'invitee@example.com',
        id: 'inv_789',
        organization: { name: 'Team' },
        inviter: { user: { email: 'admin@example.com' } },
      });

      expect(buildEmailRequestContextMock).not.toHaveBeenCalled();
    });
  });
});
