import { redirect } from '@tanstack/react-router';
import { getRequestHeaders } from '@tanstack/react-start/server';
import { getAuth } from '@/init';

export async function requireVerifiedWebSession(
  headers: Headers = getRequestHeaders()
) {
  const session = await getAuth().api.getSession({ headers });

  if (!session || !session.user.emailVerified) {
    throw redirect({ to: '/signin' });
  }

  return {
    headers,
    session,
    userId: session.user.id,
  };
}
