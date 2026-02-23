import { createElement } from 'react';
import { APP_NAME, sendEmail } from '@/email/resend.server';
import { buildEmailRequestContext } from '@/email/email-request-context.server';
import { ChangeEmailApprovalEmail } from '@/components/email-template/change-email-approval-email';
import { EmailVerificationEmail } from '@/components/email-template/email-verification-email';
import { ResetPasswordEmail } from '@/components/email-template/reset-password-email';
import { WorkspaceInvitationEmail } from '@/components/email-template/workspace-invitation-email';
import { buildAcceptInviteUrl } from './auth-workspace.server';

export const sendChangeEmailConfirmation = async ({
  user,
  newEmail,
  url,
}: {
  user: { email: string };
  newEmail: string;
  url: string;
}) => {
  const requestContext = buildEmailRequestContext();
  await sendEmail({
    to: user.email,
    subject: 'Approve your email change',
    react: createElement(ChangeEmailApprovalEmail, {
      appName: APP_NAME,
      newEmail,
      approvalUrl: url,
      requestContext,
    }),
  });
};

export const sendResetPasswordEmail = async ({
  user,
  url,
}: {
  user: { email: string };
  url: string;
}) => {
  const requestContext = buildEmailRequestContext();
  await sendEmail({
    to: user.email,
    subject: 'Reset your password',
    react: createElement(ResetPasswordEmail, {
      appName: APP_NAME,
      resetUrl: url,
      requestContext,
    }),
  });
};

export const sendVerificationEmail = async ({
  user,
  url,
}: {
  user: { email: string };
  url: string;
}) => {
  const requestContext = buildEmailRequestContext();
  await sendEmail({
    to: user.email,
    subject: 'Verify your email address',
    react: createElement(EmailVerificationEmail, {
      appName: APP_NAME,
      verificationUrl: url,
      requestContext,
    }),
  });
};

export const sendInvitationEmail = async (data: {
  email: string;
  id: string;
  organization: { name: string };
  inviter: { user: { email: string } };
}) => {
  await sendEmail({
    to: data.email,
    subject: `Join ${data.organization.name} on ${APP_NAME}`,
    react: createElement(WorkspaceInvitationEmail, {
      appName: APP_NAME,
      workspaceName: data.organization.name,
      inviterEmail: data.inviter.user.email,
      invitationUrl: buildAcceptInviteUrl(data.id),
    }),
  });
};
