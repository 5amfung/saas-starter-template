import { createElement } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  sendEmailMock,
  buildEmailRequestContextMock,
  getRequestHeadersMock,
  emitCountMetricMock,
} = vi.hoisted(() => ({
  sendEmailMock: vi.fn(),
  buildEmailRequestContextMock: vi.fn(),
  getRequestHeadersMock: vi.fn(),
  emitCountMetricMock: vi.fn(),
}));

vi.mock('@/email', () => ({
  buildEmailRequestContext: buildEmailRequestContextMock,
}));

vi.mock('@/observability/server', () => ({
  METRICS: {
    EMAIL_VERIFICATION_SENT: 'email.verification.sent',
    EMAIL_PASSWORD_RESET_SENT: 'email.password_reset.sent',
    EMAIL_WORKSPACE_INVITATION_SENT: 'email.workspace_invitation.sent',
  },
  emitCountMetric: emitCountMetricMock,
}));

// Mock email template components to simple strings for assertion simplicity.
vi.mock('@/email/templates/change-email-approval-email', () => ({
  ChangeEmailApprovalEmail: 'ChangeEmailApprovalEmail',
}));

vi.mock('@/email/templates/email-verification-email', () => ({
  EmailVerificationEmail: 'EmailVerificationEmail',
}));

vi.mock('@/email/templates/reset-password-email', () => ({
  ResetPasswordEmail: 'ResetPasswordEmail',
}));

vi.mock('@/email/templates/workspace-invitation-email', () => ({
  WorkspaceInvitationEmail: 'WorkspaceInvitationEmail',
}));

// Lazily import the module under test after all mocks are registered.
const { createAuthEmails } = await import('@/auth/server/auth-emails.server');

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
      expect(emitCountMetricMock).toHaveBeenCalledWith(
        'email.password_reset.sent',
        { result: 'success' }
      );
    });

    it('does not emit specific metrics when the email send fails', async () => {
      sendEmailMock.mockRejectedValueOnce(new Error('send failed'));

      await expect(
        emails.sendResetPasswordEmail({
          user: { email: 'user@example.com' },
          url: 'https://app.example.com/reset',
        })
      ).rejects.toMatchObject({ message: 'send failed' });

      expect(emitCountMetricMock).not.toHaveBeenCalled();
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
      expect(emitCountMetricMock).toHaveBeenCalledWith(
        'email.verification.sent',
        { result: 'success' }
      );
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
      expect(emitCountMetricMock).toHaveBeenCalledWith(
        'email.workspace_invitation.sent',
        { result: 'success' }
      );
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

    it('strips trailing slash from base URL', async () => {
      const emailsWithSlash = createAuthEmails({
        emailClient: {
          sendEmail: sendEmailMock,
          config: {
            appName: 'TestApp',
            apiKey: 'test',
            fromEmail: 'test@test.com',
          },
        },
        getRequestHeaders: getRequestHeadersMock,
        baseUrl: 'http://localhost:3000/',
      });

      await emailsWithSlash.sendInvitationEmail({
        email: 'invitee@example.com',
        id: 'inv_slash',
        organization: { name: 'Team' },
        inviter: { user: { email: 'admin@example.com' } },
      });

      expect(sendEmailMock).toHaveBeenCalledWith(
        expect.objectContaining({
          react: expect.objectContaining({
            props: expect.objectContaining({
              invitationUrl: 'http://localhost:3000/accept-invite?id=inv_slash',
            }),
          }),
        })
      );
    });

    it('falls back to localhost when base URL is empty', async () => {
      const emailsEmpty = createAuthEmails({
        emailClient: {
          sendEmail: sendEmailMock,
          config: {
            appName: 'TestApp',
            apiKey: 'test',
            fromEmail: 'test@test.com',
          },
        },
        getRequestHeaders: getRequestHeadersMock,
        baseUrl: '',
      });

      await emailsEmpty.sendInvitationEmail({
        email: 'invitee@example.com',
        id: 'inv_empty',
        organization: { name: 'Team' },
        inviter: { user: { email: 'admin@example.com' } },
      });

      expect(sendEmailMock).toHaveBeenCalledWith(
        expect.objectContaining({
          react: expect.objectContaining({
            props: expect.objectContaining({
              invitationUrl: 'http://localhost:3000/accept-invite?id=inv_empty',
            }),
          }),
        })
      );
    });
  });
});
