import { redirect } from '@tanstack/react-router';
import { createMiddleware } from '@tanstack/react-start';
import { getRequestHeaders } from '@tanstack/react-start/server';
import { auth } from '@/auth/auth.server';
import { ensureActiveWorkspaceForSession } from '@/workspace/workspace.server';

/** Validates that the request has an authenticated, email-verified session and an active workspace. */
export async function validateAuthSession(headers: Headers) {
  const session = await auth.api.getSession({ headers });
  if (!session || !session.user.emailVerified) {
    throw redirect({ to: '/signin' });
  }
  await ensureActiveWorkspaceForSession(headers, {
    user: { id: session.user.id },
    session: session.session,
  });
  return session;
}

/** Validates that the request is from a guest (no verified session). Redirects authenticated users. */
export async function validateGuestSession(headers: Headers) {
  const session = await auth.api.getSession({ headers });
  if (session?.user.emailVerified) {
    throw redirect({ to: '/ws' });
  }
}

export const authMiddleware = createMiddleware().server(async ({ next }) => {
  const headers = getRequestHeaders();
  await validateAuthSession(headers);
  return await next();
});

export const guestMiddleware = createMiddleware().server(async ({ next }) => {
  const headers = getRequestHeaders();
  await validateGuestSession(headers);
  return await next();
});
