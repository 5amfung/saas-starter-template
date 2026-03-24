import { APIError } from 'better-auth/api';
import {
  ensureActiveWorkspaceForSession,
  ensureWorkspaceMembership,
  listUserWorkspaces,
} from '@/workspace/workspace.server';

const { listOrganizationsMock, setActiveOrganizationMock } = vi.hoisted(() => ({
  listOrganizationsMock: vi.fn(),
  setActiveOrganizationMock: vi.fn(),
}));

vi.mock('@/init', () => ({
  auth: {
    api: {
      listOrganizations: listOrganizationsMock,
      setActiveOrganization: setActiveOrganizationMock,
    },
  },
}));

describe('workspace.server', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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

    it('throws NOT_FOUND for empty workspace list', async () => {
      const consoleSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});
      listOrganizationsMock.mockResolvedValueOnce([]);

      await expect(
        ensureWorkspaceMembership(new Headers(), 'org_missing')
      ).rejects.toBeInstanceOf(APIError);

      consoleSpy.mockRestore();
    });
  });
});
