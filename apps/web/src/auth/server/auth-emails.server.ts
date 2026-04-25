import { createElement } from 'react';
import type { EmailClient } from '@/email';
import { buildEmailRequestContext } from '@/email';
import { ChangeEmailApprovalEmail } from '@/email/templates/change-email-approval-email';
import { EmailVerificationEmail } from '@/email/templates/email-verification-email';
import { ResetPasswordEmail } from '@/email/templates/reset-password-email';
import { WorkspaceInvitationEmail } from '@/email/templates/workspace-invitation-email';

const ensureTrailingSlashRemoved = (value: string): string =>
  value.endsWith('/') ? value.slice(0, -1) : value;

/** Builds the accept-invite URL using the provided base URL. */
const buildAcceptInviteUrl = (
  baseUrl: string,
  invitationId: string
): string => {
  const origin = ensureTrailingSlashRemoved(
    baseUrl && baseUrl.trim() !== '' ? baseUrl.trim() : 'http://localhost:3000'
  );
  return `${origin}/accept-invite?id=${encodeURIComponent(invitationId)}`;
};

interface AuthEmailDeps {
  emailClient: EmailClient;
  getRequestHeaders?: () => Headers;
  baseUrl: string;
}

export function createAuthEmails(deps: AuthEmailDeps) {
  const { emailClient, getRequestHeaders, baseUrl } = deps;

  const getRequestContext = () =>
    buildEmailRequestContext(getRequestHeaders?.());

  const sendChangeEmailConfirmation = async ({
    user,
    newEmail,
    url,
  }: {
    user: { email: string };
    newEmail: string;
    url: string;
  }) => {
    const requestContext = getRequestContext();
    await emailClient.sendEmail({
      to: user.email,
      subject: 'Approve your email change',
      react: createElement(ChangeEmailApprovalEmail, {
        appName: emailClient.config.appName,
        newEmail,
        approvalUrl: url,
        requestContext,
      }),
    });
  };

  const sendResetPasswordEmail = async ({
    user,
    url,
  }: {
    user: { email: string };
    url: string;
  }) => {
    const requestContext = getRequestContext();
    await emailClient.sendEmail({
      to: user.email,
      subject: 'Reset your password',
      react: createElement(ResetPasswordEmail, {
        appName: emailClient.config.appName,
        resetUrl: url,
        requestContext,
      }),
    });
  };

  const sendVerificationEmail = async ({
    user,
    url,
  }: {
    user: { email: string };
    url: string;
  }) => {
    const requestContext = getRequestContext();
    await emailClient.sendEmail({
      to: user.email,
      subject: 'Verify your email address',
      react: createElement(EmailVerificationEmail, {
        appName: emailClient.config.appName,
        verificationUrl: url,
        requestContext,
      }),
    });
  };

  const sendInvitationEmail = async (data: {
    email: string;
    id: string;
    organization: { name: string };
    inviter: { user: { email: string } };
  }) => {
    await emailClient.sendEmail({
      to: data.email,
      subject: `Join ${data.organization.name} on ${emailClient.config.appName}`,
      react: createElement(WorkspaceInvitationEmail, {
        appName: emailClient.config.appName,
        workspaceName: data.organization.name,
        inviterEmail: data.inviter.user.email,
        invitationUrl: buildAcceptInviteUrl(baseUrl, data.id),
      }),
    });
  };

  return {
    sendChangeEmailConfirmation,
    sendResetPasswordEmail,
    sendVerificationEmail,
    sendInvitationEmail,
  };
}
