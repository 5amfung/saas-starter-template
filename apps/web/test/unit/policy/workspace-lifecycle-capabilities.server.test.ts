import { APIError } from 'better-auth/api';
import {
  getWorkspaceLifecycleCapabilitiesForUser,
  getWorkspaceMemberRemovalCapabilitiesForUser,
  requireWorkspaceDeleteAllowedForUser,
  requireWorkspaceLeaveAllowedForUser,
  requireWorkspaceMemberRemovalAllowedForUser,
} from '@/policy/workspace-lifecycle-capabilities.server';

const {
  ensureWorkspaceMembershipMock,
  getActiveMemberRoleMock,
  countOwnedWorkspacesMock,
  getWorkspaceBillingDataMock,
  getWorkspaceMemberByIdMock,
} = vi.hoisted(() => ({
  ensureWorkspaceMembershipMock: vi.fn(),
  getActiveMemberRoleMock: vi.fn(),
  countOwnedWorkspacesMock: vi.fn(),
  getWorkspaceBillingDataMock: vi.fn(),
  getWorkspaceMemberByIdMock: vi.fn(),
}));

vi.mock('@/workspace/workspace.server', () => ({
  ensureWorkspaceMembership: ensureWorkspaceMembershipMock,
  getActiveMemberRole: getActiveMemberRoleMock,
  countOwnedWorkspaces: countOwnedWorkspacesMock,
  getWorkspaceMemberById: getWorkspaceMemberByIdMock,
}));

vi.mock('@/billing/billing.server', () => ({
  getWorkspaceBillingData: getWorkspaceBillingDataMock,
}));

describe('workspace-lifecycle-capabilities.server', () => {
  const headers = new Headers({ 'x-test': '1' });

  beforeEach(() => {
    vi.clearAllMocks();
    ensureWorkspaceMembershipMock.mockResolvedValue({
      id: 'ws-1',
      name: 'Workspace 1',
    });
    countOwnedWorkspacesMock.mockResolvedValue(2);
    getWorkspaceBillingDataMock.mockResolvedValue({
      planId: 'free',
      subscription: null,
    });
  });

  it('allows deleting a workspace when the actor owns another personal workspace', async () => {
    getActiveMemberRoleMock.mockResolvedValueOnce('owner');

    const capabilities = await getWorkspaceLifecycleCapabilitiesForUser(
      headers,
      'ws-1',
      'user-1'
    );

    expect(capabilities.canDeleteWorkspace).toBe(true);
    expect(capabilities.deleteWorkspaceBlockedReason).toBeNull();
  });

  it('blocks deleting the last personal workspace', async () => {
    getActiveMemberRoleMock.mockResolvedValueOnce('owner');
    countOwnedWorkspacesMock.mockResolvedValueOnce(1);

    const capabilities = await getWorkspaceLifecycleCapabilitiesForUser(
      headers,
      'ws-1',
      'user-1'
    );

    expect(capabilities.canDeleteWorkspace).toBe(false);
    expect(capabilities.deleteWorkspaceBlockedReason).toBe(
      'last-personal-workspace'
    );
  });

  it('blocks owner leave', async () => {
    getActiveMemberRoleMock.mockResolvedValueOnce('owner');

    const capabilities = await getWorkspaceLifecycleCapabilitiesForUser(
      headers,
      'ws-1',
      'user-1'
    );

    expect(capabilities.canLeaveWorkspace).toBe(false);
    expect(capabilities.leaveWorkspaceBlockedReason).toBe(
      'owner-cannot-leave'
    );
  });

  it('blocks removing an owner member', async () => {
    getActiveMemberRoleMock.mockResolvedValueOnce('admin');
    getWorkspaceMemberByIdMock.mockResolvedValueOnce({
      id: 'member-1',
      userId: 'user-2',
      role: 'owner',
    });

    const capabilities = await getWorkspaceMemberRemovalCapabilitiesForUser(
      headers,
      'ws-1',
      'user-1',
      'member-1'
    );

    expect(capabilities.canRemoveMember).toBe(false);
    expect(capabilities.removeMemberBlockedReason).toBe('cannot-remove-owner');
  });

  it('throws when delete is forbidden', async () => {
    getActiveMemberRoleMock.mockResolvedValueOnce('owner');
    countOwnedWorkspacesMock.mockResolvedValueOnce(1);

    await expect(
      requireWorkspaceDeleteAllowedForUser(headers, 'ws-1', 'user-1')
    ).rejects.toBeInstanceOf(APIError);
  });

  it('throws when leave is forbidden', async () => {
    getActiveMemberRoleMock.mockResolvedValueOnce('owner');

    await expect(
      requireWorkspaceLeaveAllowedForUser(headers, 'ws-1', 'user-1')
    ).rejects.toBeInstanceOf(APIError);
  });

  it('throws when owner removal is forbidden', async () => {
    getActiveMemberRoleMock.mockResolvedValueOnce('admin');
    getWorkspaceMemberByIdMock.mockResolvedValueOnce({
      id: 'member-1',
      userId: 'user-2',
      role: 'owner',
    });

    await expect(
      requireWorkspaceMemberRemovalAllowedForUser(
        headers,
        'ws-1',
        'user-1',
        'member-1'
      )
    ).rejects.toBeInstanceOf(APIError);
  });
});
