import { createElement } from 'react';
import { buildEmailRequestContext } from '@workspace/email';
import { ChangeEmailApprovalEmail } from '@workspace/email/templates/change-email-approval-email';
import { EmailVerificationEmail } from '@workspace/email/templates/email-verification-email';
import { ResetPasswordEmail } from '@workspace/email/templates/reset-password-email';
import type { EmailClient } from '@workspace/email';

interface AdminAuthEmailDeps {
  emailClient: EmailClient;
  getRequestHeaders?: () => Headers;
  baseUrl: string;
}

export function createAdminAuthEmails(deps: AdminAuthEmailDeps) {
  const { emailClient, getRequestHeaders } = deps;

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

  return {
    sendChangeEmailConfirmation,
    sendResetPasswordEmail,
    sendVerificationEmail,
  };
}
