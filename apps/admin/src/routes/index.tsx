import { createFileRoute, redirect } from '@tanstack/react-router';
import type { AdminAppEntry } from '@/policy/admin-app-capabilities.shared';
import { getAdminAppCapabilitiesForEntry } from '@/policy/admin-app-capabilities.shared';
import { getAdminAppEntryRedirect } from '@/policy/admin-app-capabilities.shared';
import { getAdminAppEntry } from '@/policy/admin-app-capabilities.functions';
import { getDefaultAdminRoute } from '@/policy/admin-app-route-access';

export function getIndexRedirectTarget(entry: AdminAppEntry) {
  if (entry.kind === 'canEnterAdminApp') {
    const defaultRoute = getDefaultAdminRoute(
      getAdminAppCapabilitiesForEntry(entry)
    );

    return { to: defaultRoute ?? '/dashboard' as const };
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
