export type WorkspaceRole = 'owner' | 'admin' | 'member';

export interface WorkspacePolicyContext {
  workspaceRole: WorkspaceRole | null;
  isLastWorkspace: boolean;
  hasActiveSubscription: boolean;
}

export interface WorkspaceCapabilities {
  workspaceRole: WorkspaceRole | null;
  canViewOverview: boolean;
  canViewProjects: boolean;
  canViewMembers: boolean;
  canViewSettings: boolean;
  canViewBilling: boolean;
  canInviteMembers: boolean;
  canManageMembers: boolean;
  canManageSettings: boolean;
  canManageBilling: boolean;
  canDeleteWorkspace: boolean;
  deleteWorkspaceBlockedReason:
    | 'not-owner'
    | 'active-subscription'
    | 'last-workspace'
    | null;
}

export type WorkspaceCapability = keyof Omit<
  WorkspaceCapabilities,
  'workspaceRole' | 'deleteWorkspaceBlockedReason'
>;

const emptyCapabilities = (
  workspaceRole: WorkspaceRole | null
): WorkspaceCapabilities => ({
  workspaceRole,
  canViewOverview: false,
  canViewProjects: false,
  canViewMembers: false,
  canViewSettings: false,
  canViewBilling: false,
  canInviteMembers: false,
  canManageMembers: false,
  canManageSettings: false,
  canManageBilling: false,
  canDeleteWorkspace: false,
  deleteWorkspaceBlockedReason:
    workspaceRole === 'owner' ? 'active-subscription' : 'not-owner',
});

export function evaluateWorkspaceCapabilities(
  context: WorkspacePolicyContext
): WorkspaceCapabilities {
  const { workspaceRole, isLastWorkspace, hasActiveSubscription } = context;
  if (!workspaceRole) return emptyCapabilities(null);

  if (workspaceRole === 'member') {
    return {
      ...emptyCapabilities(workspaceRole),
      canViewOverview: true,
      canViewProjects: true,
      canViewMembers: true,
      deleteWorkspaceBlockedReason: 'not-owner',
    };
  }

  const baseAdminCapabilities: WorkspaceCapabilities = {
    ...emptyCapabilities(workspaceRole),
    canViewOverview: true,
    canViewProjects: true,
    canViewMembers: true,
    canViewSettings: true,
    canViewBilling: true,
    canInviteMembers: true,
    canManageMembers: true,
    canManageSettings: true,
    canManageBilling: true,
    canDeleteWorkspace: false,
    deleteWorkspaceBlockedReason: 'not-owner',
  };

  if (workspaceRole === 'admin') return baseAdminCapabilities;

  return {
    ...baseAdminCapabilities,
    workspaceRole,
    canDeleteWorkspace: !isLastWorkspace && !hasActiveSubscription,
    deleteWorkspaceBlockedReason: hasActiveSubscription
      ? 'active-subscription'
      : isLastWorkspace
        ? 'last-workspace'
        : null,
  };
}

export function hasWorkspaceCapability(
  capabilities: WorkspaceCapabilities,
  capability: WorkspaceCapability
): boolean {
  return capabilities[capability];
}
