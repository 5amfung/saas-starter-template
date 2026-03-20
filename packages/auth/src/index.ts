// This barrel re-exports only client-safe code (types, constants, pure functions).
// Server-only exports are available via sub-path imports:
//   - createAuth, Auth, AuthConfig, AuthHooks -> "@workspace/auth/server"
//   - authClient -> "@workspace/auth/client"
//   - getVerifiedSession, validateGuestSession, validateAdminSession -> "@workspace/auth/validators"
// Mixing server-only modules here would pull node:stream into the client bundle.

export type {
  AuthConfig,
  AuthHooks,
  Auth,
  StripePlanConfig,
} from './auth.server';
export * from './permissions';
export * from './workspace-types';
export {
  isSignInPath,
  isDuplicateOrganizationError,
  type SessionLike,
} from './auth-hooks.server';
export {
  isRecord,
  isWorkspaceType,
  asOptionalString,
  validateWorkspaceFields,
  buildAcceptInviteUrl,
} from './auth-workspace.server';
