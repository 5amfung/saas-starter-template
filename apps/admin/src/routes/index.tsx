import { createFileRoute, redirect } from '@tanstack/react-router';
import { createServerFn } from '@tanstack/react-start';
import { getRequestHeaders } from '@tanstack/react-start/server';
import { auth } from '@/init';

const getSessionStatus = createServerFn().handler(async () => {
  const headers = getRequestHeaders();
  const session = await auth.api.getSession({ headers });
  return {
    isAdmin: !!session?.user.emailVerified && session.user.role === 'admin',
  };
});

export const Route = createFileRoute('/')({
  beforeLoad: async () => {
    const { isAdmin } = await getSessionStatus();
    if (isAdmin) {
      throw redirect({ to: '/dashboard' });
    }
    throw redirect({ to: '/signin' });
  },
});
