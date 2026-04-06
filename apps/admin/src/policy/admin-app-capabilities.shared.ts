import {
  evaluateAdminAppCapabilities,
  evaluateAdminAppEntryCapabilities,
} from '@workspace/policy';
import type {
  AdminAppCapabilities,
  AdminAppEntryCapabilities,
  AuthEntryFacts,
} from '@workspace/policy';

export interface AdminAppSessionLike {
  user?: {
    id?: string;
    name?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    role?: string | null;
  } | null;
  session?: {
    id?: string;
  } | null;
}

export interface AdminAppEntryRedirect {
  kind: 'redirect';
  to: '/signin' | '/verify';
  search?: { error: 'admin_only' };
  facts: AuthEntryFacts;
  capabilities: AdminAppEntryCapabilities;
}

export interface AdminAppEntryAllowed {
  kind: 'canEnterAdminApp';
  facts: AuthEntryFacts;
  capabilities: AdminAppEntryCapabilities;
}

export type AdminAppEntry = AdminAppEntryRedirect | AdminAppEntryAllowed;

export interface AdminAppRedirectOptions {
  to: '/signin' | '/verify' | '/dashboard';
  search?: { error: 'admin_only' };
}

export type AdminAppEntryRedirectContext = 'root' | 'guest' | 'protected';

export function getAdminAppEntryFacts(
  session: AdminAppSessionLike | null | undefined
): AuthEntryFacts {
  const hasSession = Boolean(session?.user);

  return {
    hasSession,
    emailVerified: session?.user?.emailVerified === true,
    platformRole:
      session?.user?.role === 'admin' ? 'admin' : hasSession ? 'user' : null,
  };
}

export function getAdminAppEntryForSession(
  session: AdminAppSessionLike | null | undefined
): AdminAppEntry {
  const facts = getAdminAppEntryFacts(session);
  const capabilities = evaluateAdminAppEntryCapabilities(facts);

  if (capabilities.mustSignIn) {
    return {
      kind: 'redirect',
      to: '/signin',
      facts,
      capabilities,
    };
  }

  if (capabilities.mustVerifyEmail) {
    return {
      kind: 'redirect',
      to: '/verify',
      facts,
      capabilities,
    };
  }

  if (capabilities.isAdminOnlyDenied) {
    return {
      kind: 'redirect',
      to: '/signin',
      search: { error: 'admin_only' },
      facts,
      capabilities,
    };
  }

  return {
    kind: 'canEnterAdminApp',
    facts,
    capabilities,
  };
}

export function getAdminAppCapabilitiesForEntry(
  entry: AdminAppEntry
): AdminAppCapabilities {
  const capabilities = evaluateAdminAppCapabilities({
    platformRole: entry.facts.platformRole,
  });

  if (entry.capabilities.canEnterAdminApp) {
    return capabilities;
  }

  return {
    ...capabilities,
    canAccessAdminApp: false,
    canViewDashboard: false,
    canViewAdminDashboard: false,
    canViewAnalytics: false,
    canViewUsers: false,
    canManageUsers: false,
    canDeleteUsers: false,
    canViewWorkspaces: false,
    canViewWorkspaceBilling: false,
    canManageEntitlementOverrides: false,
    canPerformSupportActions: false,
  };
}

export function getAdminAppEntryRedirect(
  entry: AdminAppEntry,
  context: AdminAppEntryRedirectContext
): AdminAppRedirectOptions | null {
  if (entry.kind === 'canEnterAdminApp') {
    return context === 'guest' ? { to: '/dashboard' } : null;
  }

  if (context === 'guest') {
    return null;
  }

  if (entry.search) {
    return {
      to: entry.to,
      search: entry.search,
    };
  }

  return { to: entry.to };
}

export function getAdminAppCapabilitiesForSession(
  session: AdminAppSessionLike | null | undefined
): AdminAppCapabilities {
  return getAdminAppCapabilitiesForEntry(getAdminAppEntryForSession(session));
}
