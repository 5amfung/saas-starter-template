export const OPERATIONS = {
  AUTH_INVITE_ACCEPT: 'auth.invite.accept',
  AUTH_PASSWORD_RESET_REQUEST: 'auth.password_reset.request',
  AUTH_SIGN_IN: 'auth.sign_in',
  AUTH_SIGN_UP: 'auth.sign_up',
  ADMIN_USER_DELETE: 'admin.user.delete',
  ADMIN_USER_UPDATE: 'admin.user.update',
  ADMIN_WORKSPACE_API_KEY_CREATE: 'admin.workspace.api_key.create',
  ADMIN_WORKSPACE_API_KEY_DELETE: 'admin.workspace.api_key.delete',
  ADMIN_WORKSPACE_ENTITLEMENTS_CLEAR: 'admin.workspace.entitlements.clear',
  ADMIN_WORKSPACE_ENTITLEMENTS_SAVE: 'admin.workspace.entitlements.save',
  BILLING_CHECKOUT_CREATE_SESSION: 'billing.checkout.create_session',
  BILLING_PORTAL_CREATE_SESSION: 'billing.portal.create_session',
  BILLING_SUBSCRIPTION_CANCEL: 'billing.subscription.cancel',
  BILLING_SUBSCRIPTION_DOWNGRADE: 'billing.subscription.downgrade',
  BILLING_SUBSCRIPTION_REACTIVATE: 'billing.subscription.reactivate',
  WORKSPACE_CREATE: 'workspace.create',
  WORKSPACE_DELETE: 'workspace.delete',
  WORKSPACE_MEMBER_INVITE: 'workspace.member.invite',
  WORKSPACE_MEMBER_LEAVE: 'workspace.member.leave',
  WORKSPACE_MEMBER_REMOVE: 'workspace.member.remove',
  WORKSPACE_TRANSFER_OWNERSHIP: 'workspace.transfer_ownership',
} as const;

export type WorkflowOperation = (typeof OPERATIONS)[keyof typeof OPERATIONS];

export type WorkflowOperationFamily =
  | 'auth'
  | 'admin'
  | 'billing'
  | 'workspace';

export const METRICS = {
  AUTH_SIGNUP_CREATED: 'auth.signup.created',
  AUTH_EMAIL_VERIFIED: 'auth.email.verified',
  AUTH_PASSWORD_RESET_COMPLETED: 'auth.password_reset.completed',
  AUTH_SIGNIN_GOOGLE_COMPLETED: 'auth.signin.google.completed',
  BILLING_SUBSCRIPTION_STARTER_CREATED: 'billing.subscription.starter.created',
  BILLING_SUBSCRIPTION_PRO_CREATED: 'billing.subscription.pro.created',
  BILLING_SUBSCRIPTION_FREE_DOWNGRADED: 'billing.subscription.free.downgraded',
  BILLING_SUBSCRIPTION_STARTER_DOWNGRADED:
    'billing.subscription.starter.downgraded',
  EMAIL_SENT: 'email.sent',
  EMAIL_VERIFICATION_SENT: 'email.verification.sent',
  EMAIL_PASSWORD_RESET_SENT: 'email.password_reset.sent',
  EMAIL_WORKSPACE_INVITATION_SENT: 'email.workspace_invitation.sent',
  API_REQUEST_LATENCY_MS: 'api.request.latency_ms',
} as const;

export type MetricName = (typeof METRICS)[keyof typeof METRICS];
