export const AUTH_OPERATIONS = {
  signInStarted: 'auth.sign_in.started',
  signInFailed: 'auth.sign_in.failed',
  passwordResetRequested: 'auth.password_reset.requested',
  invitationAccepted: 'auth.invitation.accepted',
} as const;

export const BILLING_OPERATIONS = {
  checkoutStarted: 'billing.checkout.started',
  checkoutCompleted: 'billing.checkout.completed',
  portalOpened: 'billing.portal.opened',
  subscriptionUpdated: 'billing.subscription.updated',
} as const;

export const WORKSPACE_OPERATIONS = {
  memberInvited: 'workspace.member.invited',
  memberRemoved: 'workspace.member.removed',
  ownershipTransferred: 'workspace.ownership.transferred',
  settingsUpdated: 'workspace.settings.updated',
} as const;
