import { createElement } from "react"
import { getRequestHeaders } from "@tanstack/react-start/server"
import { buildEmailRequestContext } from "@workspace/email"
import { ChangeEmailApprovalEmail } from "@workspace/email/templates/change-email-approval-email"
import { EmailVerificationEmail } from "@workspace/email/templates/email-verification-email"
import { ResetPasswordEmail } from "@workspace/email/templates/reset-password-email"
import { WorkspaceInvitationEmail } from "@workspace/email/templates/workspace-invitation-email"
import { emailClient } from "@/init"
import { buildAcceptInviteUrl } from "./auth-workspace.server"

export const sendChangeEmailConfirmation = async ({
  user,
  newEmail,
  url,
}: {
  user: { email: string }
  newEmail: string
  url: string
}) => {
  const requestContext = buildEmailRequestContext(getRequestHeaders())
  await emailClient.sendEmail({
    to: user.email,
    subject: "Approve your email change",
    react: createElement(ChangeEmailApprovalEmail, {
      appName: emailClient.config.appName,
      newEmail,
      approvalUrl: url,
      requestContext,
    }),
  })
}

export const sendResetPasswordEmail = async ({
  user,
  url,
}: {
  user: { email: string }
  url: string
}) => {
  const requestContext = buildEmailRequestContext(getRequestHeaders())
  await emailClient.sendEmail({
    to: user.email,
    subject: "Reset your password",
    react: createElement(ResetPasswordEmail, {
      appName: emailClient.config.appName,
      resetUrl: url,
      requestContext,
    }),
  })
}

export const sendVerificationEmail = async ({
  user,
  url,
}: {
  user: { email: string }
  url: string
}) => {
  const requestContext = buildEmailRequestContext(getRequestHeaders())
  await emailClient.sendEmail({
    to: user.email,
    subject: "Verify your email address",
    react: createElement(EmailVerificationEmail, {
      appName: emailClient.config.appName,
      verificationUrl: url,
      requestContext,
    }),
  })
}

export const sendInvitationEmail = async (data: {
  email: string
  id: string
  organization: { name: string }
  inviter: { user: { email: string } }
}) => {
  await emailClient.sendEmail({
    to: data.email,
    subject: `Join ${data.organization.name} on ${emailClient.config.appName}`,
    react: createElement(WorkspaceInvitationEmail, {
      appName: emailClient.config.appName,
      workspaceName: data.organization.name,
      inviterEmail: data.inviter.user.email,
      invitationUrl: buildAcceptInviteUrl(data.id),
    }),
  })
}
