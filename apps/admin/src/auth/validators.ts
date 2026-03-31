import { redirect } from '@tanstack/react-router';
import type { Auth } from '@workspace/auth/server';

/** Gets a verified admin session or redirects. Non-admin users are rejected. */
export async function getVerifiedAdminSession(headers: Headers, auth: Auth) {
  const session = await auth.api.getSession({ headers });
  if (!session || !session.user.emailVerified) {
    throw redirect({ to: '/signin' });
  }
  if (session.user.role !== 'admin') {
    throw redirect({ to: '/signin', search: { error: 'admin_only' } });
  }
  return session;
}

/** Checks if user is authenticated admin. If so, redirects to /dashboard. */
export async function validateGuestSession(headers: Headers, auth: Auth) {
  const session = await auth.api.getSession({ headers });
  if (session?.user.emailVerified && session.user.role === 'admin') {
    throw redirect({ to: '/dashboard' });
  }
}
