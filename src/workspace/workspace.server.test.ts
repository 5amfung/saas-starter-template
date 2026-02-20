import { APIError } from 'better-auth/api';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ensureActiveWorkspaceForSession,
  ensureWorkspaceMembership,
} from '@/workspace/workspace.server';

const listOrganizationsMock = vi.fn();
const setActiveOrganizationMock = vi.fn();

vi.mock('@/auth/auth.server', () => ({
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
    listOrganizationsMock.mockResolvedValueOnce({
      organizations: [
        {
          id: 'org_personal',
          name: 'Personal',
          metadata: {
            workspaceType: 'personal',
            personalOwnerUserId: 'user_1',
          },
        },
      ],
    });
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
    listOrganizationsMock.mockResolvedValueOnce({
      organizations: [{ id: 'org_team', name: 'Team Space', metadata: {} }],
    });
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
    listOrganizationsMock.mockResolvedValueOnce({
      organizations: [
        {
          id: 'org_team',
          name: 'Team Space',
          metadata: { workspaceType: 'team' },
        },
        {
          id: 'org_personal',
          name: 'My Private Space',
          metadata: {
            workspaceType: 'personal',
            personalOwnerUserId: 'user_1',
          },
        },
      ],
    });
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

  it('returns the current active workspace without resetting it', async () => {
    listOrganizationsMock.mockResolvedValueOnce({
      organizations: [
        {
          id: 'org_personal',
          name: 'Personal',
          metadata: {
            workspaceType: 'personal',
            personalOwnerUserId: 'user_1',
          },
        },
      ],
    });

    const workspace = await ensureActiveWorkspaceForSession(new Headers(), {
      user: { id: 'user_1' },
      session: { activeOrganizationId: 'org_personal' },
    });

    expect(workspace.id).toBe('org_personal');
    expect(setActiveOrganizationMock).not.toHaveBeenCalled();
  });

  it('throws when user has no workspaces', async () => {
    listOrganizationsMock.mockResolvedValueOnce({ organizations: [] });

    await expect(
      ensureActiveWorkspaceForSession(new Headers(), {
        user: { id: 'user_1' },
        session: { activeOrganizationId: null },
      }),
    ).rejects.toBeInstanceOf(APIError);
  });

  it('rejects non-member workspace access', async () => {
    listOrganizationsMock.mockResolvedValueOnce({
      organizations: [
        {
          id: 'org_personal',
          name: 'Personal',
          metadata: { workspaceType: 'personal', personalOwnerUserId: 'user_1' },
        },
      ],
    });

    await expect(
      ensureWorkspaceMembership(new Headers(), 'user_1', 'org_missing'),
    ).rejects.toBeInstanceOf(APIError);
  });
});
