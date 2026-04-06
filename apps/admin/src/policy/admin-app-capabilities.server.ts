import { APIError } from 'better-auth/api';
import { getRequestHeaders } from '@tanstack/react-start/server';
import { hasAdminAppCapability } from '@workspace/policy';
import { getAdminAppCapabilitiesForSession } from './admin-app-capabilities.shared';
import type {
  AdminAppCapabilities,
  AdminAppCapability,
} from '@workspace/policy';
import type { AdminAppSessionLike } from './admin-app-capabilities.shared';
import { getAuth } from '@/init';

export async function getCurrentAdminAppCapabilities(
  headers: Headers = getRequestHeaders()
): Promise<AdminAppCapabilities> {
  const session = (await getAuth().api.getSession({
    headers,
  })) as AdminAppSessionLike | null;

  return getAdminAppCapabilitiesForSession(session);
}

export async function requireCurrentAdminAppCapability(
  capability: AdminAppCapability,
  headers: Headers = getRequestHeaders()
) {
  const capabilities = await getCurrentAdminAppCapabilities(headers);

  if (!hasAdminAppCapability(capabilities, capability)) {
    throw new APIError('FORBIDDEN', {
      message: `forbidden: missing admin app capability ${capability}`,
    });
  }

  return capabilities;
}
