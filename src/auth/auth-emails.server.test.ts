import { createElement } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  sendChangeEmailConfirmation,
  sendInvitationEmail,
  sendResetPasswordEmail,
  sendVerificationEmail,
} from './auth-emails.server';

const { sendEmailMock, buildEmailRequestContextMock } = vi.hoisted(() => ({
  sendEmailMock: vi.fn(),
  buildEmailRequestContextMock: vi.fn(),
}));

vi.mock('@/email/resend.server', () => ({
  sendEmail: sendEmailMock,
  APP_NAME: 'TestApp',
}));

vi.mock('@/email/email-request-context.server', () => ({
  buildEmailRequestContext: buildEmailRequestContextMock,
}));

// Mock email template components to simple strings for assertion simplicity.
vi.mock('@/components/email-template/change-email-approval-email', () => ({
  ChangeEmailApprovalEmail: 'ChangeEmailApprovalEmail',
}));

vi.mock('@/components/email-template/email-verification-email', () => ({
  EmailVerificationEmail: 'EmailVerificationEmail',
}));

vi.mock('@/components/email-template/reset-password-email', () => ({
  ResetPasswordEmail: 'ResetPasswordEmail',
}));

vi.mock('@/components/email-template/workspace-invitation-email', () => ({
  WorkspaceInvitationEmail: 'WorkspaceInvitationEmail',
}));

const MOCK_REQUEST_CONTEXT = {
  requestedAtUtc: '12 March 2026, 10:00 UTC',
  ip: '1.2.3.4',
};

describe('auth-emails', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    buildEmailRequestContextMock.mockReturnValue(MOCK_REQUEST_CONTEXT);
  });

  describe('sendChangeEmailConfirmation', () => {
    it('sends email with correct parameters', async () => {
      await sendChangeEmailConfirmation({
        user: { email: 'old@example.com' },
        newEmail: 'new@example.com',
        url: 'https://app.example.com/verify-change',
      });

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
      await sendResetPasswordEmail({
        user: { email: 'user@example.com' },
        url: 'https://app.example.com/reset',
      });

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
      await sendVerificationEmail({
        user: { email: 'user@example.com' },
        url: 'https://app.example.com/verify',
      });

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
      await sendInvitationEmail({
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
      await sendInvitationEmail({
        email: 'invitee@example.com',
        id: 'inv_789',
        organization: { name: 'Team' },
        inviter: { user: { email: 'admin@example.com' } },
      });

      expect(buildEmailRequestContextMock).not.toHaveBeenCalled();
    });
  });
});
