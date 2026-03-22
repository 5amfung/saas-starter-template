// src/middleware/auth.test.ts
import { createMockSessionResponse } from '@workspace/test-utils';
import { validateAuthSession, validateGuestSession } from '@/middleware/auth';

const {
  mockGetSession,
  mockEnsureActiveWorkspace,
  mockGetRequestHeaders,
  capturedServerFns,
} = vi.hoisted(() => {
  const capturedServerFns: Record<
    string,
    (opts: { next: () => Promise<unknown> }) => Promise<unknown>
  > = {};
  return {
    mockGetSession: vi.fn(),
    mockEnsureActiveWorkspace: vi.fn(),
    mockGetRequestHeaders: vi.fn(() => new Headers({ cookie: 'test' })),
    capturedServerFns,
  };
});

vi.mock('@/init', () => ({
  auth: { api: { getSession: mockGetSession } },
}));

vi.mock('@/workspace/workspace.server', () => ({
  ensureActiveWorkspaceForSession: mockEnsureActiveWorkspace,
}));

vi.mock('@tanstack/react-start/server', () => ({
  getRequestHeaders: mockGetRequestHeaders,
}));

vi.mock('@tanstack/react-start', () => ({
  createMiddleware: () => ({
    server: (
      fn: (opts: { next: () => Promise<unknown> }) => Promise<unknown>
    ) => {
      const index = Object.keys(capturedServerFns).length;
      const key = `middleware_${index}`;
      capturedServerFns[key] = fn;
      return { _key: key };
    },
  }),
}));

describe('validateAuthSession', () => {
  const headers = new Headers({ cookie: 'test' });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('throws redirect to /signin when no session exists', async () => {
    mockGetSession.mockResolvedValue(null);
    await expect(validateAuthSession(headers)).rejects.toEqual(
      expect.objectContaining({
        options: expect.objectContaining({ to: '/signin' }),
      })
    );
  });

  it('throws redirect to /signin when emailVerified is false', async () => {
    mockGetSession.mockResolvedValue(
      createMockSessionResponse({ emailVerified: false })
    );
    await expect(validateAuthSession(headers)).rejects.toEqual(
      expect.objectContaining({
        options: expect.objectContaining({ to: '/signin' }),
      })
    );
  });

  it('calls ensureActiveWorkspaceForSession for verified sessions', async () => {
    const session = createMockSessionResponse();
    mockGetSession.mockResolvedValue(session);
    mockEnsureActiveWorkspace.mockResolvedValue(undefined);

    await validateAuthSession(headers);

    expect(mockEnsureActiveWorkspace).toHaveBeenCalledWith(headers, {
      user: { id: session.user.id },
      session: session.session,
    });
  });

  it('handles malformed session object (missing user)', async () => {
    mockGetSession.mockResolvedValue({ session: null, user: null });
    await expect(validateAuthSession(headers)).rejects.toThrow();
  });

  it('handles getSession throwing an error', async () => {
    mockGetSession.mockRejectedValue(new Error('Auth service unavailable'));
    await expect(validateAuthSession(headers)).rejects.toThrow(
      'Auth service unavailable'
    );
  });

  it('propagates errors from ensureActiveWorkspaceForSession', async () => {
    const session = createMockSessionResponse();
    mockGetSession.mockResolvedValue(session);
    mockEnsureActiveWorkspace.mockRejectedValue(new Error('workspace error'));

    await expect(validateAuthSession(headers)).rejects.toThrow(
      'workspace error'
    );
  });
});

describe('validateGuestSession', () => {
  const headers = new Headers({ cookie: 'test' });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns without throwing when no session exists', async () => {
    mockGetSession.mockResolvedValue(null);
    await expect(validateGuestSession(headers)).resolves.toBeUndefined();
  });

  it('returns without throwing when emailVerified is false', async () => {
    mockGetSession.mockResolvedValue(
      createMockSessionResponse({ emailVerified: false })
    );
    await expect(validateGuestSession(headers)).resolves.toBeUndefined();
  });

  it('handles getSession throwing an error', async () => {
    mockGetSession.mockRejectedValue(new Error('Auth service unavailable'));
    await expect(validateGuestSession(headers)).rejects.toThrow(
      'Auth service unavailable'
    );
  });

  it('throws redirect to /ws when session has emailVerified true', async () => {
    mockGetSession.mockResolvedValue(
      createMockSessionResponse({ emailVerified: true })
    );
    await expect(validateGuestSession(headers)).rejects.toEqual(
      expect.objectContaining({
        options: expect.objectContaining({ to: '/ws' }),
      })
    );
  });
});

describe('authMiddleware (createMiddleware wrapper)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetRequestHeaders.mockReturnValue(new Headers({ cookie: 'test' }));
  });

  it('calls next on successful auth validation', async () => {
    const session = createMockSessionResponse();
    mockGetSession.mockResolvedValue(session);
    mockEnsureActiveWorkspace.mockResolvedValue(undefined);
    const mockNext = vi.fn().mockResolvedValue('next-result');

    const serverFn = capturedServerFns['middleware_0'];
    const result = await serverFn({ next: mockNext });

    expect(mockGetRequestHeaders).toHaveBeenCalled();
    expect(mockNext).toHaveBeenCalled();
    expect(result).toBe('next-result');
  });

  it('propagates auth validation errors', async () => {
    mockGetSession.mockResolvedValue(null);
    const mockNext = vi.fn();

    const serverFn = capturedServerFns['middleware_0'];
    await expect(serverFn({ next: mockNext })).rejects.toThrow();
    expect(mockNext).not.toHaveBeenCalled();
  });
});

describe('guestMiddleware (createMiddleware wrapper)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetRequestHeaders.mockReturnValue(new Headers({ cookie: 'test' }));
  });

  it('calls next for guest visitors', async () => {
    mockGetSession.mockResolvedValue(null);
    const mockNext = vi.fn().mockResolvedValue('next-result');

    const serverFn = capturedServerFns['middleware_1'];
    const result = await serverFn({ next: mockNext });

    expect(mockNext).toHaveBeenCalled();
    expect(result).toBe('next-result');
  });

  it('propagates redirect for authenticated users', async () => {
    mockGetSession.mockResolvedValue(
      createMockSessionResponse({ emailVerified: true })
    );
    const mockNext = vi.fn();

    const serverFn = capturedServerFns['middleware_1'];
    await expect(serverFn({ next: mockNext })).rejects.toEqual(
      expect.objectContaining({
        options: expect.objectContaining({ to: '/ws' }),
      })
    );
    expect(mockNext).not.toHaveBeenCalled();
  });
});
