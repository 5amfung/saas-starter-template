import { createMiddleware } from '@tanstack/react-start';
import { getRequestHeaders } from '@tanstack/react-start/server';
import {
  getVerifiedSession,
  validateGuestSession as validateGuest,
} from '@workspace/auth/validators';
import { ensureActiveWorkspaceForSession } from '@/workspace/workspace.server';
import { auth } from '@/init';

/** Validates that the request has an authenticated, email-verified session and an active workspace. */
export async function validateAuthSession(headers: Headers) {
  const session = await getVerifiedSession(headers, auth);
  await ensureActiveWorkspaceForSession(headers, {
    user: { id: session.user.id },
    session: session.session,
  });
  return session;
}

/** Validates that the request is from a guest (no verified session). Redirects authenticated users. */
export async function validateGuestSession(headers: Headers) {
  await validateGuest(headers, auth);
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
