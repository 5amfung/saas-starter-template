import { APIError } from 'better-auth/api';
import {
  createMockSessionResponse,
  createMockWorkspace,
} from '@workspace/test-utils';
import { createServerFnMock } from '../../mocks/server-fn';
import {
  ensureWorkspaceRouteAccess,
  getActiveWorkspaceId,
  getWorkspaceById,
  getWorkspaceRouteAccess,
} from '@/workspace/workspace.functions';

const {
  getAuthMock,
  getSessionMock,
  getRequestHeadersMock,
  ensureWorkspaceMembershipMock,
  setActiveOrganizationMock,
  requireWebAppEntryMock,
  getActiveMemberRoleMock,
} = vi.hoisted(() => ({
  getAuthMock: vi.fn(),
  getSessionMock: vi.fn(),
  getRequestHeadersMock: vi.fn().mockReturnValue(new Headers()),
  ensureWorkspaceMembershipMock: vi.fn(),
  setActiveOrganizationMock: vi.fn(),
  requireWebAppEntryMock: vi.fn(),
  getActiveMemberRoleMock: vi.fn(),
}));

vi.mock('@tanstack/react-start', () => createServerFnMock());

vi.mock('@/init', () => ({
  getAuth: getAuthMock,
}));

beforeEach(() => {
  getAuthMock.mockReturnValue({
    api: {
      getSession: getSessionMock,
      setActiveOrganization: setActiveOrganizationMock,
    },
  });
});

vi.mock('@tanstack/react-start/server', () => ({
  getRequestHeaders: getRequestHeadersMock,
}));

vi.mock('@/workspace/workspace.server', () => ({
  ensureWorkspaceMembership: ensureWorkspaceMembershipMock,
  getActiveMemberRole: getActiveMemberRoleMock,
}));

vi.mock('@/policy/web-app-entry.server', () => ({
  requireWebAppEntry: requireWebAppEntryMock,
}));

vi.mock('@tanstack/react-router', () => ({
  redirect: vi.fn((opts: unknown) => {
    throw opts;
  }),
}));

describe('resolveWorkspaceRouteAccess (via getWorkspaceById)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getRequestHeadersMock.mockReturnValue(new Headers());
    getAuthMock.mockReturnValue({
      api: {
        getSession: getSessionMock,
        setActiveOrganization: setActiveOrganizationMock,
      },
    });
  });

  it('redirects to /signin when no session', async () => {
    getSessionMock.mockResolvedValueOnce(null);

    await expect(
      getWorkspaceById({ data: { workspaceId: 'ws-1' } })
    ).rejects.toMatchObject({
      to: '/signin',
    });
  });

  it('redirects to /signin when email not verified', async () => {
    const session = createMockSessionResponse({ emailVerified: false });
    getSessionMock.mockResolvedValueOnce(session);

    await expect(
      getWorkspaceById({ data: { workspaceId: 'ws-1' } })
    ).rejects.toMatchObject({
      to: '/signin',
    });
  });

  it('returns workspace when user is a member', async () => {
    const session = createMockSessionResponse(
      {},
      { activeOrganizationId: 'ws-1' }
    );
    const workspace = createMockWorkspace({ id: 'ws-1' });
    getSessionMock.mockResolvedValueOnce(session);
    ensureWorkspaceMembershipMock.mockResolvedValueOnce(workspace);

    const result = await getWorkspaceById({ data: { workspaceId: 'ws-1' } });

    expect(result).toEqual(workspace);
  });

  it('switches active workspace when different from current', async () => {
    const session = createMockSessionResponse(
      {},
      { activeOrganizationId: 'ws-other' }
    );
    const workspace = createMockWorkspace({ id: 'ws-1' });
    getSessionMock.mockResolvedValueOnce(session);
    ensureWorkspaceMembershipMock.mockResolvedValueOnce(workspace);
    setActiveOrganizationMock.mockResolvedValueOnce({});

    await getWorkspaceById({ data: { workspaceId: 'ws-1' } });

    expect(setActiveOrganizationMock).toHaveBeenCalledWith({
      body: { organizationId: 'ws-1' },
      headers: expect.any(Headers),
    });
  });

  it('skips switching when already on correct workspace', async () => {
    const session = createMockSessionResponse(
      {},
      { activeOrganizationId: 'ws-1' }
    );
    const workspace = createMockWorkspace({ id: 'ws-1' });
    getSessionMock.mockResolvedValueOnce(session);
    ensureWorkspaceMembershipMock.mockResolvedValueOnce(workspace);

    await getWorkspaceById({ data: { workspaceId: 'ws-1' } });

    expect(setActiveOrganizationMock).not.toHaveBeenCalled();
  });

  it('throws NOT_FOUND when user is not a member', async () => {
    const session = createMockSessionResponse();
    getSessionMock.mockResolvedValueOnce(session);
    ensureWorkspaceMembershipMock.mockRejectedValueOnce(
      new APIError('NOT_FOUND', { message: 'Workspace not found.' })
    );

    await expect(
      getWorkspaceById({ data: { workspaceId: 'ws-missing' } })
    ).rejects.toBeInstanceOf(APIError);
  });
});

describe('getActiveWorkspaceId', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getRequestHeadersMock.mockReturnValue(new Headers());
    getAuthMock.mockReturnValue({
      api: {
        getSession: getSessionMock,
        setActiveOrganization: setActiveOrganizationMock,
      },
    });
  });

  it('redirects to /signin when no session', async () => {
    requireWebAppEntryMock.mockRejectedValueOnce({ to: '/signin' });

    await expect(getActiveWorkspaceId()).rejects.toMatchObject({
      to: '/signin',
    });
  });

  it('returns activeOrganizationId when already set', async () => {
    requireWebAppEntryMock.mockResolvedValueOnce({
      kind: 'canEnterWebApp',
      activeWorkspaceId: 'ws-active',
      capabilities: {
        canEnterWebApp: true,
        mustSignIn: false,
        mustVerifyEmail: false,
        mustResolveWorkspace: false,
      },
    });

    const result = await getActiveWorkspaceId();

    expect(result).toBe('ws-active');
    expect(requireWebAppEntryMock).toHaveBeenCalledWith(expect.any(Headers));
  });

  it('uses requireWebAppEntry to resolve and return the active workspace id', async () => {
    requireWebAppEntryMock.mockResolvedValueOnce({
      kind: 'canEnterWebApp',
      activeWorkspaceId: 'ws-fallback',
      capabilities: {
        canEnterWebApp: true,
        mustSignIn: false,
        mustVerifyEmail: false,
        mustResolveWorkspace: false,
      },
    });

    const result = await getActiveWorkspaceId();

    expect(result).toBe('ws-fallback');
    expect(requireWebAppEntryMock).toHaveBeenCalledWith(expect.any(Headers));
  });
});

describe('ensureWorkspaceRouteAccess', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getRequestHeadersMock.mockReturnValue(new Headers());
    getAuthMock.mockReturnValue({
      api: {
        getSession: getSessionMock,
        setActiveOrganization: setActiveOrganizationMock,
      },
    });
  });

  it('returns workspaceId when user has access', async () => {
    const session = createMockSessionResponse(
      {},
      { activeOrganizationId: 'ws-1' }
    );
    const workspace = createMockWorkspace({ id: 'ws-1' });
    getSessionMock.mockResolvedValueOnce(session);
    ensureWorkspaceMembershipMock.mockResolvedValueOnce(workspace);

    const result = await ensureWorkspaceRouteAccess({
      data: { workspaceId: 'ws-1' },
    });

    expect(result).toEqual({ workspaceId: 'ws-1' });
  });
});

describe('getWorkspaceRouteAccess', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getRequestHeadersMock.mockReturnValue(new Headers());
    getAuthMock.mockReturnValue({
      api: {
        getSession: getSessionMock,
        setActiveOrganization: setActiveOrganizationMock,
      },
    });
  });

  it('returns route access facts without becoming the long-lived workspace entity store', async () => {
    const session = createMockSessionResponse(
      {},
      { activeOrganizationId: 'ws-1' }
    );
    const workspace = createMockWorkspace({ id: 'ws-1' });
    getSessionMock.mockResolvedValueOnce(session);
    ensureWorkspaceMembershipMock.mockResolvedValueOnce(workspace);
    getActiveMemberRoleMock.mockResolvedValueOnce('owner');

    const result = await getWorkspaceRouteAccess({
      data: { workspaceId: 'ws-1' },
    });

    expect(result).toEqual({ workspaceId: 'ws-1', role: 'owner' });
    expect(result).not.toHaveProperty('workspace');
  });
});
