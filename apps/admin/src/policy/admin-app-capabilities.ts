import { authClient } from '@workspace/auth/client';
import { getAdminAppCapabilitiesForSession } from './admin-app-capabilities.shared';

export function useAdminAppCapabilities() {
  const { data: session, isPending } = authClient.useSession();

  return {
    session,
    isPending,
    capabilities: getAdminAppCapabilitiesForSession(session),
  };
}
