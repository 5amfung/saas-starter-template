import { createFileRoute, redirect } from '@tanstack/react-router';
import { createServerFn } from '@tanstack/react-start';
import { getRequestHeaders } from '@tanstack/react-start/server';
import { auth } from '@/init';

const redirectByAuthStatus = createServerFn().handler(async () => {
  const headers = getRequestHeaders();
  const session = await auth.api.getSession({ headers });
  if (session?.user.emailVerified) {
    throw redirect({ to: '/ws' });
  }
  throw redirect({ to: '/signin' });
});

export const Route = createFileRoute('/')({
  beforeLoad: () => redirectByAuthStatus(),
});
