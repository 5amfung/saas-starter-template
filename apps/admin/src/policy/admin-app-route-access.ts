import { redirect } from '@tanstack/react-router';
import type {
  AdminAppCapabilities,
  AdminAppCapability,
} from '@workspace/policy';

const ADMIN_ROUTE_BY_CAPABILITY = [
  ['canViewDashboard', '/dashboard'],
  ['canViewUsers', '/users'],
  ['canViewWorkspaces', '/workspaces'],
] as const satisfies ReadonlyArray<
  readonly [AdminAppCapability, '/dashboard' | '/users' | '/workspaces']
>;

export function getDefaultAdminRoute(capabilities: AdminAppCapabilities) {
  const match = ADMIN_ROUTE_BY_CAPABILITY.find(
    ([capability]) => capabilities[capability]
  );

  return match?.[1] ?? null;
}

export function requireAdminRouteCapability(
  capabilities: AdminAppCapabilities,
  capability: AdminAppCapability
) {
  if (capabilities[capability]) {
    return;
  }

  const fallbackRoute = getDefaultAdminRoute(capabilities);
  throw redirect({ to: fallbackRoute ?? '/signin' });
}
