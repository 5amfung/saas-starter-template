import type { WorkspaceRole } from './workspace';

export interface WorkspaceLifecycleContext {
  actorWorkspaceRole: WorkspaceRole | null;
  ownedWorkspaceCount: number;
  hasActiveSubscription: boolean;
}

export interface WorkspaceLifecycleCapabilities {
  canDeleteWorkspace: boolean;
  deleteWorkspaceBlockedReason:
    | 'not-owner'
    | 'active-subscription'
    | 'last-personal-workspace'
    | null;
  canLeaveWorkspace: boolean;
  leaveWorkspaceBlockedReason: 'owner-cannot-leave' | null;
}

export interface WorkspaceMemberRemovalContext extends WorkspaceLifecycleContext {
  targetMemberRole: WorkspaceRole | null;
  targetMemberIsSelf: boolean;
}

export interface WorkspaceMemberRemovalCapabilities {
  canRemoveMember: boolean;
  removeMemberBlockedReason:
    | 'cannot-remove-self'
    | 'cannot-remove-owner'
    | null;
}

export type WorkspaceOwnershipTransferTarget =
  | {
      targetMemberExists: true;
      targetMemberRole: WorkspaceRole;
      targetMemberIsSelf: boolean;
    }
  | {
      targetMemberExists: false;
    };

export interface WorkspaceOwnershipTransferContext {
  actorWorkspaceRole: WorkspaceRole | null;
  targetMember: WorkspaceOwnershipTransferTarget;
}

export interface WorkspaceOwnershipTransferCapabilities {
  canTransferWorkspaceOwnership: boolean;
  transferWorkspaceOwnershipBlockedReason:
    | 'not-owner'
    | 'target-not-found'
    | 'cannot-transfer-to-self'
    | 'target-already-owner'
    | null;
}

export function evaluateWorkspaceLifecycleCapabilities(
  context: WorkspaceLifecycleContext
): WorkspaceLifecycleCapabilities {
  const isOwner = context.actorWorkspaceRole === 'owner';
  const canDeleteWorkspace =
    isOwner &&
    !context.hasActiveSubscription &&
    context.ownedWorkspaceCount > 1;

  return {
    canDeleteWorkspace,
    deleteWorkspaceBlockedReason: !isOwner
      ? 'not-owner'
      : context.hasActiveSubscription
        ? 'active-subscription'
        : context.ownedWorkspaceCount <= 1
          ? 'last-personal-workspace'
          : null,
    canLeaveWorkspace:
      context.actorWorkspaceRole !== 'owner' &&
      context.actorWorkspaceRole !== null,
    leaveWorkspaceBlockedReason:
      context.actorWorkspaceRole === 'owner' ? 'owner-cannot-leave' : null,
  };
}

export function evaluateWorkspaceMemberRemovalCapabilities(
  context: WorkspaceMemberRemovalContext
): WorkspaceMemberRemovalCapabilities {
  if (context.targetMemberIsSelf) {
    return {
      canRemoveMember: false,
      removeMemberBlockedReason: 'cannot-remove-self',
    };
  }

  if (context.targetMemberRole === 'owner') {
    return {
      canRemoveMember: false,
      removeMemberBlockedReason: 'cannot-remove-owner',
    };
  }

  return {
    canRemoveMember: true,
    removeMemberBlockedReason: null,
  };
}

export function evaluateWorkspaceOwnershipTransferCapabilities(
  context: WorkspaceOwnershipTransferContext
): WorkspaceOwnershipTransferCapabilities {
  if (context.actorWorkspaceRole !== 'owner') {
    return {
      canTransferWorkspaceOwnership: false,
      transferWorkspaceOwnershipBlockedReason: 'not-owner',
    };
  }

  if (!context.targetMember.targetMemberExists) {
    return {
      canTransferWorkspaceOwnership: false,
      transferWorkspaceOwnershipBlockedReason: 'target-not-found',
    };
  }

  if (context.targetMember.targetMemberIsSelf) {
    return {
      canTransferWorkspaceOwnership: false,
      transferWorkspaceOwnershipBlockedReason: 'cannot-transfer-to-self',
    };
  }

  if (context.targetMember.targetMemberRole === 'owner') {
    return {
      canTransferWorkspaceOwnership: false,
      transferWorkspaceOwnershipBlockedReason: 'target-already-owner',
    };
  }

  return {
    canTransferWorkspaceOwnership: true,
    transferWorkspaceOwnershipBlockedReason: null,
  };
}
