import { redirect } from '@tanstack/react-router';
import type { Auth } from '@workspace/auth/server';
import type { AdminAppSessionLike } from '@/policy/admin-app-capabilities.shared';
import {
  getAdminAppEntryForSession,
  getAdminAppEntryRedirect,
} from '@/policy/admin-app-capabilities.shared';

export interface VerifiedAdminSession extends AdminAppSessionLike {
  user: NonNullable<AdminAppSessionLike['user']> & {
    id: string;
    emailVerified: true;
    role: 'admin';
  };
}

/** Gets a verified admin session or redirects. Non-admin users are rejected. */
export async function getVerifiedAdminSession(
  headers: Headers,
  auth: Auth
): Promise<VerifiedAdminSession> {
  const session = (await auth.api.getSession({
    headers,
  })) as AdminAppSessionLike | null;
  const entry = getAdminAppEntryForSession(session);
  const redirectTarget = getAdminAppEntryRedirect(entry, 'protected');

  if (redirectTarget) {
    throw redirect(redirectTarget);
  }

  return session as VerifiedAdminSession;
}

/** Checks if user is authenticated admin. If so, redirects to /dashboard. */
export async function validateGuestSession(headers: Headers, auth: Auth) {
  const session = (await auth.api.getSession({
    headers,
  })) as AdminAppSessionLike | null;
  const entry = getAdminAppEntryForSession(session);
  const redirectTarget = getAdminAppEntryRedirect(entry, 'guest');

  if (redirectTarget) {
    throw redirect(redirectTarget);
  }
}
