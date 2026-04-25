import type {
  AdminAppCapabilities,
  AdminAppEntryCapabilities,
  AdminAppEntryFacts,
} from '@/policy/core';
import {
  evaluateAdminAppCapabilities,
  evaluateAdminAppEntryCapabilities,
} from '@/policy/core';
import { ADMIN_ACCESS_DENIED, ADMIN_DASHBOARD } from '@/admin/admin-routes';

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
  search?: { redirect: typeof ADMIN_DASHBOARD };
  facts: AdminAppEntryFacts;
  capabilities: AdminAppEntryCapabilities;
}

export interface AdminAppEntryAccessDenied {
  kind: 'accessDenied';
  facts: AdminAppEntryFacts;
  capabilities: AdminAppEntryCapabilities;
}

export interface AdminAppEntryAllowed {
  kind: 'canEnterAdminApp';
  facts: AdminAppEntryFacts;
  capabilities: AdminAppEntryCapabilities;
}

export type AdminAppEntry =
  | AdminAppEntryRedirect
  | AdminAppEntryAccessDenied
  | AdminAppEntryAllowed;

export interface AdminAppRedirectOptions {
  to:
    | '/signin'
    | '/verify'
    | typeof ADMIN_ACCESS_DENIED
    | typeof ADMIN_DASHBOARD;
  search?: { redirect: typeof ADMIN_DASHBOARD };
}

export type AdminAppEntryRedirectContext = 'root' | 'guest' | 'protected';

export interface AdminAppProtectedRedirectOptions {
  to: '/signin' | '/verify' | typeof ADMIN_ACCESS_DENIED;
  search?: { redirect: typeof ADMIN_DASHBOARD };
}

export interface AdminAppGuestRedirectOptions {
  to: typeof ADMIN_DASHBOARD;
}

const deniedAdminAppCapabilities = evaluateAdminAppCapabilities({
  platformRole: null,
});

export function getAdminAppEntryFacts(
  session: AdminAppSessionLike | null | undefined
): AdminAppEntryFacts {
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
      search: { redirect: ADMIN_DASHBOARD },
      facts,
      capabilities,
    };
  }

  if (capabilities.mustVerifyEmail) {
    return {
      kind: 'redirect',
      to: '/verify',
      search: { redirect: ADMIN_DASHBOARD },
      facts,
      capabilities,
    };
  }

  if (capabilities.isAdminOnlyDenied) {
    return {
      kind: 'accessDenied',
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

export function getAdminAppEntryRedirect(
  entry: AdminAppEntry,
  context: 'protected' | 'root'
): AdminAppProtectedRedirectOptions | null;
export function getAdminAppEntryRedirect(
  entry: AdminAppEntry,
  context: 'guest'
): AdminAppGuestRedirectOptions | null;
export function getAdminAppEntryRedirect(
  entry: AdminAppEntry,
  context: AdminAppEntryRedirectContext
): AdminAppRedirectOptions | null {
  if (entry.kind === 'canEnterAdminApp') {
    return context === 'guest' ? { to: ADMIN_DASHBOARD } : null;
  }

  if (entry.kind === 'accessDenied') {
    return context === 'protected' || context === 'root'
      ? { to: ADMIN_ACCESS_DENIED }
      : null;
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
  const facts = getAdminAppEntryFacts(session);
  const entryCapabilities = evaluateAdminAppEntryCapabilities(facts);

  if (entryCapabilities.canEnterAdminApp) {
    return evaluateAdminAppCapabilities({
      platformRole: facts.platformRole,
    });
  }

  return {
    ...deniedAdminAppCapabilities,
    platformRole: facts.platformRole,
  };
}
