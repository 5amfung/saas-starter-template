import { createMiddleware } from '@tanstack/react-start';
import { redirect } from '@tanstack/react-router';
import { getRequestHeaders } from '@tanstack/react-start/server';
import { getWebAppEntryRedirectTarget } from '@/policy/web-app-entry.shared';
import {
  getCurrentWebAppEntry,
  requireWebAppEntry,
} from '@/policy/web-app-entry.server';

/** Validates that the request can enter the web app. */
export async function validateAuthSession(headers: Headers) {
  return requireWebAppEntry(headers);
}

/** Validates that the request should stay on guest routes. */
export async function validateGuestSession(headers: Headers) {
  const entry = await getCurrentWebAppEntry(headers);
  const redirectTarget = getWebAppEntryRedirectTarget(entry, 'guest');

  if (redirectTarget) {
    throw redirect({ to: redirectTarget });
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
