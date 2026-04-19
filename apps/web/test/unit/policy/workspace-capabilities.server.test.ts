import { APIError } from 'better-auth/api';
import {
  getWorkspaceCapabilitiesForUser,
  getWorkspaceRoleOnlyCapabilitiesForUser,
  requireWorkspaceCapabilityForUser,
} from '@/policy/workspace-capabilities.server';

const {
  ensureWorkspaceMembershipMock,
  getActiveMemberRoleMock,
  listUserWorkspacesMock,
  getWorkspaceBillingDataMock,
} = vi.hoisted(() => ({
  ensureWorkspaceMembershipMock: vi.fn(),
  getActiveMemberRoleMock: vi.fn(),
  listUserWorkspacesMock: vi.fn(),
  getWorkspaceBillingDataMock: vi.fn(),
}));

vi.mock('@/workspace/workspace.server', () => ({
  ensureWorkspaceMembership: ensureWorkspaceMembershipMock,
  getActiveMemberRole: getActiveMemberRoleMock,
  listUserWorkspaces: listUserWorkspacesMock,
}));

vi.mock('@/billing/billing.server', () => ({
  getWorkspaceBillingData: getWorkspaceBillingDataMock,
}));

describe('workspace-capabilities.server', () => {
  const headers = new Headers({ 'x-test': '1' });

  beforeEach(() => {
    vi.clearAllMocks();
    ensureWorkspaceMembershipMock.mockResolvedValue({
      id: 'ws-1',
      name: 'Workspace 1',
    });
    listUserWorkspacesMock.mockResolvedValue([]);
  });

  it('loads workspace facts and evaluates capabilities for the current user', async () => {
    getActiveMemberRoleMock.mockResolvedValueOnce('owner');
    listUserWorkspacesMock.mockResolvedValueOnce([
      { id: 'ws-1', name: 'Workspace 1' },
      { id: 'ws-2', name: 'Workspace 2' },
    ]);
    getWorkspaceBillingDataMock.mockResolvedValueOnce({
      planId: 'pro',
      subscription: { status: 'active' },
    });

    const capabilities = await getWorkspaceCapabilitiesForUser(
      headers,
      'ws-1',
      'user-1'
    );

    expect(getActiveMemberRoleMock).toHaveBeenCalledWith(
      headers,
      'ws-1',
      'user-1'
    );
    expect(listUserWorkspacesMock).toHaveBeenCalledWith(headers);
    expect(getWorkspaceBillingDataMock).toHaveBeenCalledWith(headers, 'ws-1');
    expect(capabilities.workspaceRole).toBe('owner');
    expect(capabilities.canManageBilling).toBe(true);
    expect(capabilities.canDeleteWorkspace).toBe(false);
  });

  it('loads role-only capabilities without reading billing facts', async () => {
    getActiveMemberRoleMock.mockResolvedValueOnce('admin');

    const capabilities = await getWorkspaceRoleOnlyCapabilitiesForUser(
      headers,
      'ws-1',
      'user-1'
    );

    expect(capabilities.workspaceRole).toBe('admin');
    expect(capabilities.canViewBilling).toBe(true);
    expect(capabilities.canManageBilling).toBe(true);
    expect('canDeleteWorkspace' in capabilities).toBe(false);
    expect('canViewIntegrations' in capabilities).toBe(false);
    expect(getWorkspaceBillingDataMock).not.toHaveBeenCalled();
  });

  it('allows owner deletion when the paid subscription is not active', async () => {
    getActiveMemberRoleMock.mockResolvedValueOnce('owner');
    listUserWorkspacesMock.mockResolvedValueOnce([
      { id: 'ws-1', name: 'Workspace 1' },
      { id: 'ws-2', name: 'Workspace 2' },
    ]);
    getWorkspaceBillingDataMock.mockResolvedValueOnce({
      planId: 'pro',
      subscription: { status: 'canceled' },
    });

    const capabilities = await getWorkspaceCapabilitiesForUser(
      headers,
      'ws-1',
      'user-1'
    );

    expect(capabilities.canDeleteWorkspace).toBe(true);
  });

  it('blocks owner deletion when a paid subscription is trialing', async () => {
    getActiveMemberRoleMock.mockResolvedValueOnce('owner');
    listUserWorkspacesMock.mockResolvedValueOnce([
      { id: 'ws-1', name: 'Workspace 1' },
      { id: 'ws-2', name: 'Workspace 2' },
    ]);
    getWorkspaceBillingDataMock.mockResolvedValueOnce({
      planId: 'pro',
      subscription: { status: 'trialing' },
    });

    const capabilities = await getWorkspaceCapabilitiesForUser(
      headers,
      'ws-1',
      'user-1'
    );

    expect(capabilities.canDeleteWorkspace).toBe(false);
  });

  it('does not read billing facts for non-members', async () => {
    ensureWorkspaceMembershipMock.mockRejectedValueOnce(
      new APIError('NOT_FOUND', { message: 'Workspace not found.' })
    );

    await expect(
      getWorkspaceCapabilitiesForUser(headers, 'ws-1', 'user-1')
    ).rejects.toBeInstanceOf(APIError);

    expect(getWorkspaceBillingDataMock).not.toHaveBeenCalled();
  });

  it('throws a forbidden APIError when a capability is missing', async () => {
    getActiveMemberRoleMock.mockResolvedValueOnce('member');
    listUserWorkspacesMock.mockResolvedValueOnce([
      { id: 'ws-1', name: 'Workspace 1' },
      { id: 'ws-2', name: 'Workspace 2' },
    ]);
    getWorkspaceBillingDataMock.mockResolvedValueOnce({
      planId: 'free',
      subscription: null,
    });

    const denied = requireWorkspaceCapabilityForUser(
      headers,
      'ws-1',
      'user-1',
      'canManageBilling'
    );

    await expect(denied).rejects.toBeInstanceOf(APIError);
    await expect(denied).rejects.toMatchObject({
      message: 'forbidden: missing workspace capability canManageBilling',
    });
  });
});
