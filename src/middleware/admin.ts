import { redirect } from '@tanstack/react-router';
import { createMiddleware } from '@tanstack/react-start';
import { getRequestHeaders } from '@tanstack/react-start/server';
import { auth } from '@/auth/auth.server';

export const adminMiddleware = createMiddleware().server(async ({ next }) => {
  const headers = getRequestHeaders();
  const session = await auth.api.getSession({ headers });

  if (!session || !session.user.emailVerified) {
    throw redirect({ to: '/signin' });
  }

  if (session.user.role !== 'admin') {
    throw redirect({ to: '/signin' });
  }

  return await next();
});
