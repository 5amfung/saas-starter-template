import { createFileRoute, redirect } from '@tanstack/react-router';
import type { AdminAppEntry } from '@/policy/admin-app-capabilities.shared';
import { getAdminAppEntryRedirect } from '@/policy/admin-app-capabilities.shared';
import { getAdminAppEntry } from '@/policy/admin-app-capabilities.functions';

export function getIndexRedirectTarget(entry: AdminAppEntry) {
  if (entry.kind === 'canEnterAdminApp') {
    return { to: '/dashboard' as const };
  }

  const redirectTarget = getAdminAppEntryRedirect(entry, 'root');

  if (redirectTarget) {
    return redirectTarget;
  }

  return { to: '/dashboard' as const };
}

export const Route = createFileRoute('/')({
  beforeLoad: async () => {
    const entry = await getAdminAppEntry();
    throw redirect(getIndexRedirectTarget(entry));
  },
});
