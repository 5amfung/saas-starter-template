import { redirect } from '@tanstack/react-router';
import type { Auth } from './auth.server';

/** Returns the current session, or null when the request is unauthenticated. */
export async function getSessionOrNull(headers: Headers, auth: Auth) {
  return auth.api.getSession({ headers });
}

/** Requires an authenticated, email-verified session. */
export async function requireVerifiedSession(headers: Headers, auth: Auth) {
  const session = await getSessionOrNull(headers, auth);
  if (!session || !session.user.emailVerified) {
    throw redirect({ to: '/signin' });
  }
  return session;
}
