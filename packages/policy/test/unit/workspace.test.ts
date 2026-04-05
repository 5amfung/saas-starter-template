import { describe, expect, it } from 'vitest';
import {
  evaluateWorkspaceCapabilities,
  hasWorkspaceCapability,
} from '../../src/workspace';
import type { WorkspacePolicyContext } from '../../src/workspace';

const baseContext = (
  overrides: Partial<WorkspacePolicyContext> = {}
): WorkspacePolicyContext => ({
  workspaceRole: 'member',
  isLastWorkspace: false,
  hasActiveSubscription: false,
  ...overrides,
});

describe('evaluateWorkspaceCapabilities', () => {
  it('grants members only read access to overview, projects, and members', () => {
    const capabilities = evaluateWorkspaceCapabilities(baseContext());

    expect(capabilities.canViewOverview).toBe(true);
    expect(capabilities.canViewProjects).toBe(true);
    expect(capabilities.canViewMembers).toBe(true);
    expect(capabilities.canViewSettings).toBe(false);
    expect(capabilities.canViewBilling).toBe(false);
    expect(capabilities.canInviteMembers).toBe(false);
    expect(capabilities.deleteWorkspaceBlockedReason).toBe('not-owner');
  });

  it('grants admins settings, billing, and member-management access', () => {
    const capabilities = evaluateWorkspaceCapabilities(
      baseContext({ workspaceRole: 'admin' })
    );

    expect(capabilities.canViewSettings).toBe(true);
    expect(capabilities.canManageSettings).toBe(true);
    expect(capabilities.canViewBilling).toBe(true);
    expect(capabilities.canManageBilling).toBe(true);
    expect(capabilities.canInviteMembers).toBe(true);
    expect(capabilities.deleteWorkspaceBlockedReason).toBe('not-owner');
  });

  it('allows owners to delete only when not last workspace and no active subscription', () => {
    expect(
      evaluateWorkspaceCapabilities(baseContext({ workspaceRole: 'owner' }))
        .canDeleteWorkspace
    ).toBe(true);
    expect(
      evaluateWorkspaceCapabilities(baseContext({ workspaceRole: 'owner' }))
        .deleteWorkspaceBlockedReason
    ).toBeNull();

    expect(
      evaluateWorkspaceCapabilities(
        baseContext({ workspaceRole: 'owner', isLastWorkspace: true })
      ).canDeleteWorkspace
    ).toBe(false);
    expect(
      evaluateWorkspaceCapabilities(
        baseContext({ workspaceRole: 'owner', isLastWorkspace: true })
      ).deleteWorkspaceBlockedReason
    ).toBe('last-workspace');

    expect(
      evaluateWorkspaceCapabilities(
        baseContext({
          workspaceRole: 'owner',
          hasActiveSubscription: true,
        })
      ).canDeleteWorkspace
    ).toBe(false);
    expect(
      evaluateWorkspaceCapabilities(
        baseContext({
          workspaceRole: 'owner',
          hasActiveSubscription: true,
        })
      ).deleteWorkspaceBlockedReason
    ).toBe('active-subscription');
  });

  it('returns no capabilities when the actor has no workspace role', () => {
    const capabilities = evaluateWorkspaceCapabilities(
      baseContext({ workspaceRole: null })
    );

    expect(
      Object.entries(capabilities).filter(([, value]) => value === true)
    ).toEqual([]);
  });

  it('checks capability names through helper APIs', () => {
    const capabilities = evaluateWorkspaceCapabilities(
      baseContext({ workspaceRole: 'admin' })
    );

    expect(hasWorkspaceCapability(capabilities, 'canManageBilling')).toBe(true);
    expect(hasWorkspaceCapability(capabilities, 'canDeleteWorkspace')).toBe(
      false
    );
  });
});
