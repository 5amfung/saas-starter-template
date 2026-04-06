import { createMiddleware } from '@tanstack/react-start';
import { getRequestHeaders } from '@tanstack/react-start/server';
import {
  getVerifiedAdminSession,
  validateGuestSession as validateGuest,
} from '@/auth/validators';
import { getAuth } from '@/init';

/** Validates that the request has an authenticated, email-verified admin session. */
export async function validateAuthSession(headers: Headers) {
  return await getVerifiedAdminSession(headers, getAuth());
}

/** Validates that the request is from a guest (no verified admin session). */
export async function validateGuestSession(headers: Headers) {
  await validateGuest(headers, getAuth());
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
