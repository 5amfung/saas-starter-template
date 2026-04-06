export type PlatformRole = 'admin' | 'user';

export interface AdminAppPolicyContext {
  platformRole: PlatformRole | null;
}

export interface AdminAppCapabilities {
  platformRole: PlatformRole | null;
  canAccessAdminApp: boolean;
  canViewDashboard: boolean;
  canViewAdminDashboard: boolean;
  canViewAnalytics: boolean;
  canViewUsers: boolean;
  canManageUsers: boolean;
  canDeleteUsers: boolean;
  canViewWorkspaces: boolean;
  canViewWorkspaceBilling: boolean;
  canManageEntitlementOverrides: boolean;
  canPerformSupportActions: boolean;
}

export type AdminAppCapability = keyof Omit<
  AdminAppCapabilities,
  'platformRole'
>;

export function evaluateAdminAppCapabilities(
  context: AdminAppPolicyContext
): AdminAppCapabilities {
  const isPlatformAdmin = context.platformRole === 'admin';
  return {
    platformRole: context.platformRole,
    canAccessAdminApp: isPlatformAdmin,
    canViewDashboard: isPlatformAdmin,
    canViewAdminDashboard: isPlatformAdmin,
    canViewAnalytics: isPlatformAdmin,
    canViewUsers: isPlatformAdmin,
    canManageUsers: isPlatformAdmin,
    canDeleteUsers: isPlatformAdmin,
    canViewWorkspaces: isPlatformAdmin,
    canViewWorkspaceBilling: isPlatformAdmin,
    canManageEntitlementOverrides: isPlatformAdmin,
    canPerformSupportActions: isPlatformAdmin,
  };
}

export function hasAdminAppCapability(
  capabilities: AdminAppCapabilities,
  capability: AdminAppCapability
): boolean {
  return capabilities[capability];
}
