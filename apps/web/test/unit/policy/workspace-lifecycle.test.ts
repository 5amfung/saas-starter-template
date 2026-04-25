import { describe, expect, it } from 'vitest';
import type {
  WorkspaceLifecycleContext,
  WorkspaceMemberRemovalContext,
  WorkspaceOwnershipTransferContext,
} from '@/policy/core';
import {
  evaluateWorkspaceLifecycleCapabilities,
  evaluateWorkspaceMemberRemovalCapabilities,
  evaluateWorkspaceOwnershipTransferCapabilities,
} from '@/policy/core';

const baseLifecycleContext = (
  overrides: Partial<WorkspaceLifecycleContext> = {}
): WorkspaceLifecycleContext => ({
  actorWorkspaceRole: 'member',
  ownedWorkspaceCount: 2,
  hasActiveSubscription: false,
  ...overrides,
});

const baseMemberRemovalContext = (
  overrides: Partial<WorkspaceMemberRemovalContext> = {}
): WorkspaceMemberRemovalContext => ({
  actorWorkspaceRole: 'admin',
  ownedWorkspaceCount: 2,
  hasActiveSubscription: false,
  targetMemberRole: 'member',
  targetMemberIsSelf: false,
  ...overrides,
});

const baseOwnershipTransferContext = (
  overrides: Partial<WorkspaceOwnershipTransferContext> = {}
): WorkspaceOwnershipTransferContext => ({
  actorWorkspaceRole: 'owner',
  targetMember: {
    targetMemberExists: true,
    targetMemberRole: 'member',
    targetMemberIsSelf: false,
  },
  ...overrides,
});

describe('evaluateWorkspaceLifecycleCapabilities', () => {
  it('grants members only leave access and denies delete', () => {
    const capabilities = evaluateWorkspaceLifecycleCapabilities(
      baseLifecycleContext()
    );

    expect(capabilities.canDeleteWorkspace).toBe(false);
    expect(capabilities.deleteWorkspaceBlockedReason).toBe('not-owner');
    expect(capabilities.canLeaveWorkspace).toBe(true);
    expect(capabilities.leaveWorkspaceBlockedReason).toBeNull();
  });

  it('allows owners to delete only when they have another personal workspace and no active subscription', () => {
    const capabilities = evaluateWorkspaceLifecycleCapabilities(
      baseLifecycleContext({ actorWorkspaceRole: 'owner' })
    );

    expect(capabilities.canDeleteWorkspace).toBe(true);
    expect(capabilities.deleteWorkspaceBlockedReason).toBeNull();

    expect(
      evaluateWorkspaceLifecycleCapabilities(
        baseLifecycleContext({
          actorWorkspaceRole: 'owner',
          ownedWorkspaceCount: 1,
        })
      )
    ).toMatchObject({
      canDeleteWorkspace: false,
      deleteWorkspaceBlockedReason: 'last-personal-workspace',
    });

    expect(
      evaluateWorkspaceLifecycleCapabilities(
        baseLifecycleContext({
          actorWorkspaceRole: 'owner',
          hasActiveSubscription: true,
        })
      )
    ).toMatchObject({
      canDeleteWorkspace: false,
      deleteWorkspaceBlockedReason: 'active-subscription',
    });
  });

  it('denies owners from leaving their own workspace', () => {
    const capabilities = evaluateWorkspaceLifecycleCapabilities(
      baseLifecycleContext({ actorWorkspaceRole: 'owner' })
    );

    expect(capabilities.canLeaveWorkspace).toBe(false);
    expect(capabilities.leaveWorkspaceBlockedReason).toBe('owner-cannot-leave');
  });

  it('returns no delete or leave access when the actor has no role', () => {
    const capabilities = evaluateWorkspaceLifecycleCapabilities(
      baseLifecycleContext({ actorWorkspaceRole: null })
    );

    expect(capabilities.canDeleteWorkspace).toBe(false);
    expect(capabilities.canLeaveWorkspace).toBe(false);
    expect(capabilities.deleteWorkspaceBlockedReason).toBe('not-owner');
    expect(capabilities.leaveWorkspaceBlockedReason).toBeNull();
  });
});

describe('evaluateWorkspaceMemberRemovalCapabilities', () => {
  it('allows removing non-owner members', () => {
    const capabilities = evaluateWorkspaceMemberRemovalCapabilities(
      baseMemberRemovalContext()
    );

    expect(capabilities.canRemoveMember).toBe(true);
    expect(capabilities.removeMemberBlockedReason).toBeNull();
  });

  it('denies removing owners', () => {
    const capabilities = evaluateWorkspaceMemberRemovalCapabilities(
      baseMemberRemovalContext({ targetMemberRole: 'owner' })
    );

    expect(capabilities.canRemoveMember).toBe(false);
    expect(capabilities.removeMemberBlockedReason).toBe('cannot-remove-owner');
  });

  it('denies self removal so leave remains the only self-exit path', () => {
    const capabilities = evaluateWorkspaceMemberRemovalCapabilities(
      baseMemberRemovalContext({ targetMemberIsSelf: true })
    );

    expect(capabilities.canRemoveMember).toBe(false);
    expect(capabilities.removeMemberBlockedReason).toBe('cannot-remove-self');
  });
});

describe('evaluateWorkspaceOwnershipTransferCapabilities', () => {
  it('allows owners to transfer ownership to non-self member or admin targets', () => {
    expect(
      evaluateWorkspaceOwnershipTransferCapabilities(
        baseOwnershipTransferContext()
      )
    ).toEqual({
      canTransferWorkspaceOwnership: true,
      transferWorkspaceOwnershipBlockedReason: null,
    });

    expect(
      evaluateWorkspaceOwnershipTransferCapabilities(
        baseOwnershipTransferContext({
          targetMember: {
            targetMemberExists: true,
            targetMemberRole: 'admin',
            targetMemberIsSelf: false,
          },
        })
      )
    ).toEqual({
      canTransferWorkspaceOwnership: true,
      transferWorkspaceOwnershipBlockedReason: null,
    });
  });

  it('blocks non-owners with not-owner', () => {
    expect(
      evaluateWorkspaceOwnershipTransferCapabilities(
        baseOwnershipTransferContext({ actorWorkspaceRole: 'admin' })
      )
    ).toEqual({
      canTransferWorkspaceOwnership: false,
      transferWorkspaceOwnershipBlockedReason: 'not-owner',
    });
  });

  it('blocks self transfer with cannot-transfer-to-self', () => {
    expect(
      evaluateWorkspaceOwnershipTransferCapabilities(
        baseOwnershipTransferContext({
          targetMember: {
            targetMemberExists: true,
            targetMemberRole: 'member',
            targetMemberIsSelf: true,
          },
        })
      )
    ).toEqual({
      canTransferWorkspaceOwnership: false,
      transferWorkspaceOwnershipBlockedReason: 'cannot-transfer-to-self',
    });
  });

  it('blocks transfer when target is already owner', () => {
    expect(
      evaluateWorkspaceOwnershipTransferCapabilities(
        baseOwnershipTransferContext({
          targetMember: {
            targetMemberExists: true,
            targetMemberRole: 'owner',
            targetMemberIsSelf: false,
          },
        })
      )
    ).toEqual({
      canTransferWorkspaceOwnership: false,
      transferWorkspaceOwnershipBlockedReason: 'target-already-owner',
    });
  });

  it('blocks transfer when target is missing', () => {
    expect(
      evaluateWorkspaceOwnershipTransferCapabilities(
        baseOwnershipTransferContext({
          targetMember: {
            targetMemberExists: false,
          },
        })
      )
    ).toEqual({
      canTransferWorkspaceOwnership: false,
      transferWorkspaceOwnershipBlockedReason: 'target-not-found',
    });
  });
});
