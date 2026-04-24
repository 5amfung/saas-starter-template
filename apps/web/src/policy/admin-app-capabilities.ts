import { useQuery } from '@tanstack/react-query';
import { authClient } from '@workspace/auth/client';
import { getAdminAppEntry } from './admin-app-capabilities.functions';
import { getAdminAppCapabilitiesForSession } from './admin-app-capabilities.shared';

export const ADMIN_APP_ENTRY_QUERY_KEY = ['admin-app', 'entry'] as const;

export function useAdminAppEntryQuery(enabled = true) {
  return useQuery({
    queryKey: ADMIN_APP_ENTRY_QUERY_KEY,
    queryFn: () => getAdminAppEntry(),
    enabled,
  });
}

export function useAdminAppEntry(enabled = true) {
  return useAdminAppEntryQuery(enabled);
}

export function useAdminAppCapabilities() {
  const { data: session, isPending } = authClient.useSession();

  return {
    session,
    isPending,
    capabilities: getAdminAppCapabilitiesForSession(session),
  };
}
