import { APIError } from 'better-auth/api';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createMockSessionResponse,
  createMockWorkspace,
} from '@workspace/test-utils';
import {
  ensureWorkspaceRouteAccess,
  getActiveWorkspaceId,
  getWorkspaceById,
} from '@/workspace/workspace.functions';

const {
  getSessionMock,
  getRequestHeadersMock,
  ensureWorkspaceMembershipMock,
  setActiveOrganizationMock,
  ensureActiveWorkspaceForSessionMock,
} = vi.hoisted(() => ({
  getSessionMock: vi.fn(),
  getRequestHeadersMock: vi.fn().mockReturnValue(new Headers()),
  ensureWorkspaceMembershipMock: vi.fn(),
  setActiveOrganizationMock: vi.fn(),
  ensureActiveWorkspaceForSessionMock: vi.fn(),
}));

vi.mock('@tanstack/react-start', () => ({
  createServerFn: () => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
    let handler: Function;
    const builder = {
      inputValidator: () => builder,
      // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
      handler: (fn: Function) => {
        handler = fn;
        const callable = (...args: Array<unknown>) => handler(...args);
        callable.inputValidator = () => builder;
        // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
        callable.handler = (fn2: Function) => {
          handler = fn2;
          return callable;
        };
        return callable;
      },
    };
    const callable = (...args: Array<unknown>) => handler(...args);
    callable.inputValidator = () => builder;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
    callable.handler = (fn: Function) => {
      handler = fn;
      return callable;
    };
    return callable;
  },
}));

vi.mock('@/init', () => ({
  auth: {
    api: {
      getSession: getSessionMock,
      setActiveOrganization: setActiveOrganizationMock,
    },
  },
}));

vi.mock('@tanstack/react-start/server', () => ({
  getRequestHeaders: getRequestHeadersMock,
}));

vi.mock('@/workspace/workspace.server', () => ({
  ensureWorkspaceMembership: ensureWorkspaceMembershipMock,
  ensureActiveWorkspaceForSession: ensureActiveWorkspaceForSessionMock,
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
  });

  it('redirects to /signin when no session', async () => {
    getSessionMock.mockResolvedValueOnce(null);

    await expect(getActiveWorkspaceId()).rejects.toMatchObject({
      to: '/signin',
    });
  });

  it('returns activeOrganizationId when already set', async () => {
    const session = createMockSessionResponse(
      {},
      { activeOrganizationId: 'ws-active' }
    );
    getSessionMock.mockResolvedValueOnce(session);

    const result = await getActiveWorkspaceId();

    expect(result).toBe('ws-active');
    expect(ensureActiveWorkspaceForSessionMock).not.toHaveBeenCalled();
  });

  it('falls back to ensureActiveWorkspaceForSession when no active ID', async () => {
    const session = createMockSessionResponse(
      {},
      { activeOrganizationId: null }
    );
    const workspace = createMockWorkspace({ id: 'ws-fallback' });
    getSessionMock.mockResolvedValueOnce(session);
    ensureActiveWorkspaceForSessionMock.mockResolvedValueOnce(workspace);

    const result = await getActiveWorkspaceId();

    expect(result).toBe('ws-fallback');
    expect(ensureActiveWorkspaceForSessionMock).toHaveBeenCalledWith(
      expect.any(Headers),
      expect.objectContaining({
        user: { id: session.user.id },
        session: session.session,
      })
    );
  });
});

describe('ensureWorkspaceRouteAccess', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getRequestHeadersMock.mockReturnValue(new Headers());
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
