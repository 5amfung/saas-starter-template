import { APIError } from 'better-auth/api';
import {
  ensureActiveWorkspaceForSession,
  ensureWorkspaceMembership,
  getActiveMemberRole,
  getWorkspaceSwitcherTriggerDetail,
  listUserWorkspaces,
} from '@/workspace/workspace.server';

const {
  getAuthMock,
  listOrganizationsMock,
  setActiveOrganizationMock,
  getFullOrganizationMock,
  resolveWorkspacePlanIdFromDbMock,
  countWorkspaceMembersMock,
} = vi.hoisted(() => ({
  getAuthMock: vi.fn(),
  listOrganizationsMock: vi.fn(),
  setActiveOrganizationMock: vi.fn(),
  getFullOrganizationMock: vi.fn(),
  resolveWorkspacePlanIdFromDbMock: vi.fn(),
  countWorkspaceMembersMock: vi.fn(),
}));

vi.mock('@/init', () => ({
  getAuth: getAuthMock,
}));

beforeEach(() => {
  getAuthMock.mockReturnValue({
    api: {
      listOrganizations: listOrganizationsMock,
      setActiveOrganization: setActiveOrganizationMock,
      getFullOrganization: getFullOrganizationMock,
    },
    billing: {
      resolveWorkspacePlanIdFromDb: resolveWorkspacePlanIdFromDbMock,
      countWorkspaceMembers: countWorkspaceMembersMock,
    },
  });
});

describe('workspace.server', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getAuthMock.mockReturnValue({
      api: {
        listOrganizations: listOrganizationsMock,
        setActiveOrganization: setActiveOrganizationMock,
        getFullOrganization: getFullOrganizationMock,
      },
      billing: {
        resolveWorkspacePlanIdFromDb: resolveWorkspacePlanIdFromDbMock,
        countWorkspaceMembers: countWorkspaceMembersMock,
      },
    });
  });

  it('falls back to first workspace when active workspace is missing', async () => {
    listOrganizationsMock.mockResolvedValueOnce([
      { id: 'org_1', name: 'First Workspace' },
    ]);
    setActiveOrganizationMock.mockResolvedValueOnce({});

    const workspace = await ensureActiveWorkspaceForSession(new Headers(), {
      user: { id: 'user_1' },
      session: { activeOrganizationId: null },
    });

    expect(workspace.id).toBe('org_1');
    expect(setActiveOrganizationMock).toHaveBeenCalledWith({
      body: { organizationId: 'org_1' },
      headers: expect.any(Headers),
    });
  });

  it('picks the first workspace when multiple exist and none is active', async () => {
    listOrganizationsMock.mockResolvedValueOnce([
      { id: 'org_team', name: 'Team Space' },
      { id: 'org_other', name: 'Other Space' },
    ]);
    setActiveOrganizationMock.mockResolvedValueOnce({});

    const workspace = await ensureActiveWorkspaceForSession(new Headers(), {
      user: { id: 'user_1' },
      session: { activeOrganizationId: null },
    });

    expect(workspace.id).toBe('org_team');
    expect(setActiveOrganizationMock).toHaveBeenCalledWith({
      body: { organizationId: 'org_team' },
      headers: expect.any(Headers),
    });
  });

  it('returns the current active workspace without resetting it', async () => {
    listOrganizationsMock.mockResolvedValueOnce([
      { id: 'org_1', name: 'Workspace' },
    ]);

    const workspace = await ensureActiveWorkspaceForSession(new Headers(), {
      user: { id: 'user_1' },
      session: { activeOrganizationId: 'org_1' },
    });

    expect(workspace.id).toBe('org_1');
    expect(setActiveOrganizationMock).not.toHaveBeenCalled();
  });

  it('throws when user has no workspaces', async () => {
    listOrganizationsMock.mockResolvedValueOnce([]);

    await expect(
      ensureActiveWorkspaceForSession(new Headers(), {
        user: { id: 'user_1' },
        session: { activeOrganizationId: null },
      })
    ).rejects.toBeInstanceOf(APIError);
  });

  it('rejects non-member workspace access', async () => {
    listOrganizationsMock.mockResolvedValueOnce([
      { id: 'org_1', name: 'Workspace' },
    ]);

    await expect(
      ensureWorkspaceMembership(new Headers(), 'org_missing')
    ).rejects.toBeInstanceOf(APIError);
  });

  describe('listUserWorkspaces', () => {
    it('returns workspaces from auth API', async () => {
      const workspaces = [
        { id: 'org_1', name: 'WS 1' },
        { id: 'org_2', name: 'WS 2' },
      ];
      listOrganizationsMock.mockResolvedValueOnce(workspaces);

      const result = await listUserWorkspaces(new Headers());

      expect(result).toEqual(workspaces);
      expect(listOrganizationsMock).toHaveBeenCalledWith({
        headers: expect.any(Headers),
      });
    });
  });

  describe('ensureWorkspaceMembership', () => {
    it('returns workspace when user is a member', async () => {
      listOrganizationsMock.mockResolvedValueOnce([
        { id: 'org_target', name: 'Target WS' },
      ]);

      const workspace = await ensureWorkspaceMembership(
        new Headers(),
        'org_target'
      );

      expect(workspace).toEqual({ id: 'org_target', name: 'Target WS' });
    });

    it('falls back to full organization lookup when the workspace list is stale', async () => {
      listOrganizationsMock.mockResolvedValueOnce([]);
      getFullOrganizationMock.mockResolvedValueOnce({
        id: 'org_target',
        name: 'Target WS',
        members: [{ userId: 'user_1', role: 'owner' }],
      });

      const workspace = await ensureWorkspaceMembership(
        new Headers(),
        'org_target'
      );

      expect(workspace).toEqual({
        id: 'org_target',
        name: 'Target WS',
        members: [{ userId: 'user_1', role: 'owner' }],
      });
      expect(getFullOrganizationMock).toHaveBeenCalledWith({
        headers: expect.any(Headers),
        query: { organizationId: 'org_target' },
      });
    });

    it('throws NOT_FOUND for empty workspace list', async () => {
      listOrganizationsMock.mockResolvedValueOnce([]);
      getFullOrganizationMock.mockResolvedValueOnce(null);

      await expect(
        ensureWorkspaceMembership(new Headers(), 'org_missing')
      ).rejects.toBeInstanceOf(APIError);
    });
  });

  describe('getActiveMemberRole', () => {
    it('returns the role when user is a member', async () => {
      getFullOrganizationMock.mockResolvedValueOnce({
        id: 'org_1',
        members: [
          { userId: 'user_1', role: 'owner' },
          { userId: 'user_2', role: 'member' },
        ],
      });

      const role = await getActiveMemberRole(new Headers(), 'org_1', 'user_1');

      expect(role).toBe('owner');
    });

    it('returns different role types correctly', async () => {
      getFullOrganizationMock.mockResolvedValueOnce({
        id: 'org_1',
        members: [
          { userId: 'user_admin', role: 'admin' },
          { userId: 'user_member', role: 'member' },
        ],
      });

      const role = await getActiveMemberRole(
        new Headers(),
        'org_1',
        'user_member'
      );

      expect(role).toBe('member');
    });

    it('returns null when organization is not found', async () => {
      getFullOrganizationMock.mockResolvedValueOnce(null);

      const role = await getActiveMemberRole(
        new Headers(),
        'org_missing',
        'user_1'
      );

      expect(role).toBeNull();
    });

    it('returns null when user is not a member of the organization', async () => {
      getFullOrganizationMock.mockResolvedValueOnce({
        id: 'org_1',
        members: [{ userId: 'other_user', role: 'owner' }],
      });

      const role = await getActiveMemberRole(
        new Headers(),
        'org_1',
        'user_not_in_org'
      );

      expect(role).toBeNull();
    });

    it('returns null when organization has empty members array', async () => {
      getFullOrganizationMock.mockResolvedValueOnce({
        id: 'org_1',
        members: [],
      });

      const role = await getActiveMemberRole(new Headers(), 'org_1', 'user_1');

      expect(role).toBeNull();
    });

    it('passes correct headers and query to the API', async () => {
      getFullOrganizationMock.mockResolvedValueOnce({
        id: 'org_target',
        members: [{ userId: 'user_1', role: 'member' }],
      });
      const headers = new Headers({ authorization: 'Bearer test' });

      await getActiveMemberRole(headers, 'org_target', 'user_1');

      expect(getFullOrganizationMock).toHaveBeenCalledWith({
        headers,
        query: { organizationId: 'org_target' },
      });
    });
  });

  describe('getWorkspaceSwitcherTriggerDetail', () => {
    it('returns the plan name and member count for a workspace from the workspace list', async () => {
      listOrganizationsMock.mockResolvedValueOnce([
        { id: 'org_1', name: 'Workspace' },
      ]);
      resolveWorkspacePlanIdFromDbMock.mockResolvedValueOnce('starter');
      countWorkspaceMembersMock.mockResolvedValueOnce(2);

      const result = await getWorkspaceSwitcherTriggerDetail(
        new Headers(),
        'org_1'
      );

      expect(result).toEqual({
        planName: 'Starter',
        memberCount: 2,
      });
      expect(getFullOrganizationMock).not.toHaveBeenCalled();
      expect(countWorkspaceMembersMock).toHaveBeenCalledWith('org_1');
      expect(resolveWorkspacePlanIdFromDbMock).toHaveBeenCalledWith('org_1');
    });

    it('returns the plan name and member count for an accessible workspace', async () => {
      listOrganizationsMock.mockResolvedValueOnce([]);
      getFullOrganizationMock.mockResolvedValueOnce({
        id: 'org_1',
        name: 'Workspace',
        members: [
          { id: 'member_1', userId: 'user_1', role: 'owner' },
          { id: 'member_2', userId: 'user_2', role: 'member' },
        ],
      });
      resolveWorkspacePlanIdFromDbMock.mockResolvedValueOnce('starter');
      countWorkspaceMembersMock.mockResolvedValueOnce(2);

      const result = await getWorkspaceSwitcherTriggerDetail(
        new Headers(),
        'org_1'
      );

      expect(result).toEqual({
        planName: 'Starter',
        memberCount: 2,
      });
      expect(countWorkspaceMembersMock).toHaveBeenCalledWith('org_1');
      expect(resolveWorkspacePlanIdFromDbMock).toHaveBeenCalledWith('org_1');
    });

    it('throws when the workspace is not accessible to the current user', async () => {
      listOrganizationsMock.mockResolvedValueOnce([]);
      getFullOrganizationMock.mockResolvedValueOnce(null);

      await expect(
        getWorkspaceSwitcherTriggerDetail(new Headers(), 'org_missing')
      ).rejects.toBeInstanceOf(APIError);
    });
  });
});
