import { APIError } from 'better-auth/api';
import { beforeEach, describe, expect, it, vi } from 'vitest';
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

  it('falls back to personal workspace when active workspace is missing', async () => {
    listOrganizationsMock.mockResolvedValueOnce([
      {
        id: 'org_personal',
        name: 'Personal',
        workspaceType: 'personal',
        personalOwnerUserId: 'user_1',
      },
    ]);
    setActiveOrganizationMock.mockResolvedValueOnce({});

    const workspace = await ensureActiveWorkspaceForSession(new Headers(), {
      user: { id: 'user_1' },
      session: { activeOrganizationId: null },
    });

    expect(workspace.id).toBe('org_personal');
    expect(setActiveOrganizationMock).toHaveBeenCalledWith({
      body: { organizationId: 'org_personal' },
      headers: expect.any(Headers),
    });
  });

  it('falls back to first workspace when no personal workspace is found', async () => {
    listOrganizationsMock.mockResolvedValueOnce([
      { id: 'org_team', name: 'Team Space', workspaceType: 'workspace' },
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

  it('prefers the owned personal workspace when multiple memberships exist', async () => {
    listOrganizationsMock.mockResolvedValueOnce([
      {
        id: 'org_team',
        name: 'Team Space',
        workspaceType: 'workspace',
      },
      {
        id: 'org_personal',
        name: 'My Private Space',
        workspaceType: 'personal',
        personalOwnerUserId: 'user_1',
      },
    ]);
    setActiveOrganizationMock.mockResolvedValueOnce({});

    const workspace = await ensureActiveWorkspaceForSession(new Headers(), {
      user: { id: 'user_1' },
      session: { activeOrganizationId: null },
    });

    expect(workspace.id).toBe('org_personal');
    expect(setActiveOrganizationMock).toHaveBeenCalledWith({
      body: { organizationId: 'org_personal' },
      headers: expect.any(Headers),
    });
  });

  it('does not pick personal workspace owned by a different user', async () => {
    listOrganizationsMock.mockResolvedValueOnce([
      {
        id: 'org_team',
        name: 'Team Space',
        workspaceType: 'workspace',
      },
      {
        id: 'org_personal_other',
        name: 'Other Personal',
        workspaceType: 'personal',
        personalOwnerUserId: 'user_other',
      },
    ]);
    setActiveOrganizationMock.mockResolvedValueOnce({});

    const workspace = await ensureActiveWorkspaceForSession(new Headers(), {
      user: { id: 'user_1' },
      session: { activeOrganizationId: null },
    });

    // Falls back to first workspace since the personal one belongs to another user.
    expect(workspace.id).toBe('org_team');
    expect(setActiveOrganizationMock).toHaveBeenCalledWith({
      body: { organizationId: 'org_team' },
      headers: expect.any(Headers),
    });
  });

  it('returns the current active workspace without resetting it', async () => {
    listOrganizationsMock.mockResolvedValueOnce([
      {
        id: 'org_personal',
        name: 'Personal',
        workspaceType: 'personal',
        personalOwnerUserId: 'user_1',
      },
    ]);

    const workspace = await ensureActiveWorkspaceForSession(new Headers(), {
      user: { id: 'user_1' },
      session: { activeOrganizationId: 'org_personal' },
    });

    expect(workspace.id).toBe('org_personal');
    expect(setActiveOrganizationMock).not.toHaveBeenCalled();
  });

  it('throws when user has no workspaces', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    listOrganizationsMock.mockResolvedValueOnce([]);

    await expect(
      ensureActiveWorkspaceForSession(new Headers(), {
        user: { id: 'user_1' },
        session: { activeOrganizationId: null },
      })
    ).rejects.toBeInstanceOf(APIError);

    consoleSpy.mockRestore();
  });

  it('rejects non-member workspace access', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    listOrganizationsMock.mockResolvedValueOnce([
      {
        id: 'org_personal',
        name: 'Personal',
        workspaceType: 'personal',
        personalOwnerUserId: 'user_1',
      },
    ]);

    await expect(
      ensureWorkspaceMembership(new Headers(), 'org_missing')
    ).rejects.toBeInstanceOf(APIError);

    consoleSpy.mockRestore();
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
