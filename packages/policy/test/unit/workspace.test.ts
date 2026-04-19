import { describe, expect, it } from 'vitest';
import {
  evaluateWorkspaceCapabilities,
  evaluateWorkspaceRoleOnlyCapabilities,
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
    expect(capabilities.canViewIntegrations).toBe(false);
    expect(capabilities.canInviteMembers).toBe(false);
    expect(capabilities.canManageIntegrations).toBe(false);
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
    expect(capabilities.canViewIntegrations).toBe(false);
    expect(capabilities.canManageIntegrations).toBe(false);
    expect(capabilities.deleteWorkspaceBlockedReason).toBe('not-owner');
  });

  it('grants admins and owners integration access only on active subscriptions', () => {
    const adminCapabilities = evaluateWorkspaceCapabilities(
      baseContext({
        workspaceRole: 'admin',
        hasActiveSubscription: true,
      })
    );

    expect(adminCapabilities.canViewIntegrations).toBe(true);
    expect(adminCapabilities.canManageIntegrations).toBe(true);

    const ownerCapabilities = evaluateWorkspaceCapabilities(
      baseContext({
        workspaceRole: 'owner',
        hasActiveSubscription: true,
      })
    );

    expect(ownerCapabilities.canViewIntegrations).toBe(true);
    expect(ownerCapabilities.canManageIntegrations).toBe(true);
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
    expect(hasWorkspaceCapability(capabilities, 'canManageIntegrations')).toBe(
      false
    );
  });
});

describe('evaluateWorkspaceRoleOnlyCapabilities', () => {
  it('grants members only lightweight read access', () => {
    const capabilities = evaluateWorkspaceRoleOnlyCapabilities('member');

    expect(capabilities.canViewOverview).toBe(true);
    expect(capabilities.canViewProjects).toBe(true);
    expect(capabilities.canViewMembers).toBe(true);
    expect(capabilities.canViewSettings).toBe(false);
    expect(capabilities.canViewBilling).toBe(false);
    expect(capabilities.canInviteMembers).toBe(false);
    expect(capabilities.canManageBilling).toBe(false);
  });

  it('grants admins and owners access decisions that do not depend on billing state', () => {
    const adminCapabilities = evaluateWorkspaceRoleOnlyCapabilities('admin');
    const ownerCapabilities = evaluateWorkspaceRoleOnlyCapabilities('owner');

    expect(adminCapabilities.canViewSettings).toBe(true);
    expect(adminCapabilities.canViewBilling).toBe(true);
    expect(adminCapabilities.canManageBilling).toBe(true);
    expect(ownerCapabilities.canViewSettings).toBe(true);
    expect(ownerCapabilities.canViewBilling).toBe(true);
    expect(ownerCapabilities.canManageBilling).toBe(true);
  });

  it('returns no access capabilities when the actor has no workspace role', () => {
    const capabilities = evaluateWorkspaceRoleOnlyCapabilities(null);

    expect(
      Object.entries(capabilities).filter(([, value]) => value === true)
    ).toEqual([]);
  });
});
