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

export function requireAdminDashboardCapability(
  headers?: Headers
): Promise<AdminAppCapabilities> {
  return requireCurrentAdminAppCapability('canViewDashboard', headers);
}

export function requireAdminAnalyticsCapability(
  headers?: Headers
): Promise<AdminAppCapabilities> {
  return requireCurrentAdminAppCapability('canViewAnalytics', headers);
}

export function requireAdminViewUsersCapability(
  headers?: Headers
): Promise<AdminAppCapabilities> {
  return requireCurrentAdminAppCapability('canViewUsers', headers);
}

export function requireAdminManageUsersCapability(
  headers?: Headers
): Promise<AdminAppCapabilities> {
  return requireCurrentAdminAppCapability('canManageUsers', headers);
}

export function requireAdminDeleteUsersCapability(
  headers?: Headers
): Promise<AdminAppCapabilities> {
  return requireCurrentAdminAppCapability('canDeleteUsers', headers);
}

export function requireAdminViewWorkspacesCapability(
  headers?: Headers
): Promise<AdminAppCapabilities> {
  return requireCurrentAdminAppCapability('canViewWorkspaces', headers);
}

export function requireAdminViewWorkspaceBillingCapability(
  headers?: Headers
): Promise<AdminAppCapabilities> {
  return requireCurrentAdminAppCapability('canViewWorkspaceBilling', headers);
}

export function requireAdminManageEntitlementOverridesCapability(
  headers?: Headers
): Promise<AdminAppCapabilities> {
  return requireCurrentAdminAppCapability(
    'canManageEntitlementOverrides',
    headers
  );
}
