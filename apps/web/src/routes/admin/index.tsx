import { createFileRoute, redirect } from '@tanstack/react-router';
import { ADMIN_DASHBOARD } from '@/admin/admin-routes';
import type { AdminAppEntry } from '@/policy/admin-app-capabilities.shared';
import { getAdminAppEntryRedirect } from '@/policy/admin-app-capabilities.shared';
import { getAdminAppEntry } from '@/policy/admin-app-capabilities.functions';

export function getIndexRedirectTarget(entry: AdminAppEntry) {
  if (entry.kind === 'canEnterAdminApp') {
    return { to: ADMIN_DASHBOARD };
  }

  const redirectTarget = getAdminAppEntryRedirect(entry, 'root');

  if (redirectTarget) {
    return redirectTarget;
  }

  return { to: ADMIN_DASHBOARD };
}

export const Route = createFileRoute('/admin/')({
  beforeLoad: async () => {
    const entry = await getAdminAppEntry();
    throw redirect(getIndexRedirectTarget(entry));
  },
});
