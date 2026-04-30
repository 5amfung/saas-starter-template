import { APIError } from 'better-auth/api';
import {
  createMockSessionResponse,
  createMockWorkspace,
} from '@workspace/test-utils';
import {
  getCurrentWebAppEntry,
  requireWebAppEntry,
  resolveWebAppEntryAccess,
} from '@/policy/web-app-entry.server';

const {
  mockGetSession,
  mockSetActiveOrganization,
  mockListAccessibleWorkspaces,
  mockResolvePreferredWorkspace,
} = vi.hoisted(() => ({
  mockGetSession: vi.fn(),
  mockSetActiveOrganization: vi.fn(),
  mockListAccessibleWorkspaces: vi.fn(),
  mockResolvePreferredWorkspace: vi.fn(),
}));

vi.mock('@/init.server', () => ({
  getAuth: () => ({
    api: {
      getSession: mockGetSession,
      setActiveOrganization: mockSetActiveOrganization,
    },
  }),
}));

vi.mock('@/workspace/workspace.server', () => ({
  listAccessibleWorkspaces: mockListAccessibleWorkspaces,
  resolvePreferredWorkspace: mockResolvePreferredWorkspace,
}));

describe('web-app-entry.server', () => {
  const headers = new Headers({ cookie: 'test=1' });

  beforeEach(() => {
    vi.clearAllMocks();
    mockListAccessibleWorkspaces.mockResolvedValue([]);
    mockResolvePreferredWorkspace.mockResolvedValue(null);
  });

  it('resolves guests to a sign-in redirect', async () => {
    mockGetSession.mockResolvedValueOnce(null);

    const entry = await getCurrentWebAppEntry(headers);

    expect(entry).toMatchObject({
      kind: 'redirect',
      to: '/signin',
      capabilities: {
        canEnterWebApp: false,
        mustSignIn: true,
        mustVerifyEmail: false,
        mustResolveWorkspace: false,
      },
    });
    expect(mockListAccessibleWorkspaces).not.toHaveBeenCalled();
  });

  it('resolves unverified sessions to a verify redirect', async () => {
    mockGetSession.mockResolvedValueOnce(
      createMockSessionResponse({ emailVerified: false })
    );

    const entry = await getCurrentWebAppEntry(headers);

    expect(entry).toMatchObject({
      kind: 'redirect',
      to: '/verify',
      capabilities: {
        canEnterWebApp: false,
        mustSignIn: false,
        mustVerifyEmail: true,
        mustResolveWorkspace: false,
      },
    });
    expect(mockListAccessibleWorkspaces).not.toHaveBeenCalled();
  });

  it('resolves verified sessions without an active workspace to the preferred workspace first', async () => {
    const preferredWorkspace = createMockWorkspace({ id: 'ws-preferred' });
    mockGetSession.mockResolvedValueOnce(
      createMockSessionResponse({}, { activeOrganizationId: null })
    );
    mockListAccessibleWorkspaces.mockResolvedValueOnce([
      preferredWorkspace,
      createMockWorkspace({ id: 'ws-secondary' }),
    ]);
    mockResolvePreferredWorkspace.mockResolvedValueOnce(preferredWorkspace);

    const entry = await getCurrentWebAppEntry(headers);

    expect(entry).toMatchObject({
      kind: 'mustResolveWorkspace',
      preferredWorkspace: { id: 'ws-preferred' },
      capabilities: {
        canEnterWebApp: false,
        mustResolveWorkspace: true,
      },
    });
    expect(mockResolvePreferredWorkspace).toHaveBeenCalledWith(
      headers,
      expect.objectContaining({
        session: expect.objectContaining({ activeOrganizationId: null }),
      }),
      expect.any(Array)
    );
  });

  it('returns a typed blocked result when a verified session has no accessible workspaces', async () => {
    mockGetSession.mockResolvedValueOnce(
      createMockSessionResponse({}, { activeOrganizationId: null })
    );
    mockListAccessibleWorkspaces.mockResolvedValueOnce([]);
    mockResolvePreferredWorkspace.mockResolvedValueOnce(null);

    const entry = await getCurrentWebAppEntry(headers);

    expect(entry).toMatchObject({
      kind: 'blocked',
      reason: 'noAccessibleWorkspaces',
      capabilities: {
        canEnterWebApp: false,
        mustResolveWorkspace: true,
      },
    });
  });

  it('returns canEnterWebApp when the verified session already has an active workspace', async () => {
    mockGetSession.mockResolvedValueOnce(
      createMockSessionResponse({}, { activeOrganizationId: 'ws-active' })
    );
    mockListAccessibleWorkspaces.mockResolvedValueOnce([
      createMockWorkspace({ id: 'ws-active' }),
    ]);

    const entry = await getCurrentWebAppEntry(headers);

    expect(entry).toMatchObject({
      kind: 'canEnterWebApp',
      activeWorkspaceId: 'ws-active',
      capabilities: {
        canEnterWebApp: true,
        mustResolveWorkspace: false,
      },
    });
    expect(mockResolvePreferredWorkspace).not.toHaveBeenCalled();
  });

  it('treats stale active workspace ids as unresolved and falls back to the preferred accessible workspace', async () => {
    const preferredWorkspace = createMockWorkspace({ id: 'ws-preferred' });
    mockGetSession.mockResolvedValueOnce(
      createMockSessionResponse({}, { activeOrganizationId: 'ws-stale' })
    );
    mockListAccessibleWorkspaces.mockResolvedValueOnce([
      preferredWorkspace,
      createMockWorkspace({ id: 'ws-secondary' }),
    ]);
    mockResolvePreferredWorkspace.mockResolvedValueOnce(preferredWorkspace);

    const entry = await getCurrentWebAppEntry(headers);

    expect(entry).toMatchObject({
      kind: 'mustResolveWorkspace',
      preferredWorkspace: { id: 'ws-preferred' },
      capabilities: {
        canEnterWebApp: false,
        mustResolveWorkspace: true,
      },
    });
    expect(mockResolvePreferredWorkspace).toHaveBeenCalledWith(
      headers,
      expect.objectContaining({
        session: expect.objectContaining({ activeOrganizationId: 'ws-stale' }),
      }),
      expect.any(Array)
    );
  });

  it('sets the active workspace explicitly in requireWebAppEntry when resolution is needed', async () => {
    const preferredWorkspace = createMockWorkspace({ id: 'ws-preferred' });
    mockGetSession.mockResolvedValueOnce(
      createMockSessionResponse({}, { activeOrganizationId: null })
    );
    mockListAccessibleWorkspaces.mockResolvedValueOnce([preferredWorkspace]);
    mockResolvePreferredWorkspace.mockResolvedValueOnce(preferredWorkspace);
    mockSetActiveOrganization.mockResolvedValueOnce({});

    const entry = await requireWebAppEntry(headers);

    expect(mockSetActiveOrganization).toHaveBeenCalledWith({
      body: { organizationId: 'ws-preferred' },
      headers,
    });
    expect(entry).toMatchObject({
      kind: 'canEnterWebApp',
      activeWorkspaceId: 'ws-preferred',
      capabilities: {
        canEnterWebApp: true,
      },
    });
  });

  it('returns redirect entries from resolveWebAppEntryAccess without throwing', async () => {
    mockGetSession.mockResolvedValueOnce(null);

    await expect(resolveWebAppEntryAccess(headers)).resolves.toMatchObject({
      kind: 'redirect',
      to: '/signin',
    });
    expect(mockSetActiveOrganization).not.toHaveBeenCalled();
  });

  it('throws a forbidden APIError from requireWebAppEntry when no accessible workspaces exist', async () => {
    mockGetSession.mockResolvedValueOnce(
      createMockSessionResponse({}, { activeOrganizationId: null })
    );
    mockListAccessibleWorkspaces.mockResolvedValueOnce([]);
    mockResolvePreferredWorkspace.mockResolvedValueOnce(null);

    const denied = requireWebAppEntry(headers);

    await expect(denied).rejects.toBeInstanceOf(APIError);
    await expect(denied).rejects.toMatchObject({
      message: 'No accessible workspaces found for this user.',
    });
  });
});
