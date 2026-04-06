import { createMiddlewareMock } from '../../mocks/middleware';
import type { CapturedServerFns } from '../../mocks/middleware';
import { validateAuthSession, validateGuestSession } from '@/middleware/auth';

const {
  mockGetRequestHeaders,
  mockGetCurrentWebAppEntry,
  mockRequireWebAppEntry,
  capturedServerFns,
} = vi.hoisted(() => ({
  mockGetRequestHeaders: vi.fn(() => new Headers({ cookie: 'test' })),
  mockGetCurrentWebAppEntry: vi.fn(),
  mockRequireWebAppEntry: vi.fn(),
  capturedServerFns: {} as CapturedServerFns,
}));

vi.mock('@/policy/web-app-entry.server', () => ({
  getCurrentWebAppEntry: mockGetCurrentWebAppEntry,
  requireWebAppEntry: mockRequireWebAppEntry,
}));

vi.mock('@tanstack/react-start/server', () => ({
  getRequestHeaders: mockGetRequestHeaders,
}));

vi.mock('@tanstack/react-start', () => createMiddlewareMock(capturedServerFns));

describe('validateAuthSession', () => {
  const headers = new Headers({ cookie: 'test' });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('delegates protected entry validation to requireWebAppEntry', async () => {
    const entry = {
      kind: 'canEnterWebApp',
      activeWorkspaceId: 'ws-1',
      capabilities: { canEnterWebApp: true },
    };
    mockRequireWebAppEntry.mockResolvedValue(entry);

    await expect(validateAuthSession(headers)).resolves.toBe(entry);

    expect(mockRequireWebAppEntry).toHaveBeenCalledWith(headers);
  });

  it('propagates entry guard failures', async () => {
    mockRequireWebAppEntry.mockRejectedValue(
      new Error('Auth service unavailable')
    );
    await expect(validateAuthSession(headers)).rejects.toMatchObject({
      message: 'Auth service unavailable',
    });
  });
});

describe('validateGuestSession', () => {
  const headers = new Headers({ cookie: 'test' });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns without throwing when the entry state is still guest-only', async () => {
    mockGetCurrentWebAppEntry.mockResolvedValue({
      kind: 'redirect',
      to: '/signin',
      capabilities: { mustSignIn: true },
    });

    await expect(validateGuestSession(headers)).resolves.toBeUndefined();
    expect(mockGetCurrentWebAppEntry).toHaveBeenCalledWith(headers);
  });

  it('redirects signed-in unverified users to verify', async () => {
    mockGetCurrentWebAppEntry.mockResolvedValue({
      kind: 'redirect',
      to: '/verify',
      capabilities: { mustVerifyEmail: true },
    });

    await expect(validateGuestSession(headers)).rejects.toEqual(
      expect.objectContaining({
        options: expect.objectContaining({ to: '/verify' }),
      })
    );
  });

  it('redirects entered app users to the protected shell', async () => {
    mockGetCurrentWebAppEntry.mockResolvedValue({
      kind: 'canEnterWebApp',
      activeWorkspaceId: 'ws-1',
      capabilities: { canEnterWebApp: true },
    });

    await expect(validateGuestSession(headers)).rejects.toEqual(
      expect.objectContaining({
        options: expect.objectContaining({ to: '/ws' }),
      })
    );
  });

  it('redirects blocked users to the protected shell so the app entry policy can handle them centrally', async () => {
    mockGetCurrentWebAppEntry.mockResolvedValue({
      kind: 'blocked',
      reason: 'noAccessibleWorkspaces',
      capabilities: { canEnterWebApp: false },
    });

    await expect(validateGuestSession(headers)).rejects.toEqual(
      expect.objectContaining({
        options: expect.objectContaining({ to: '/ws' }),
      })
    );
  });

  it('propagates entry lookup errors', async () => {
    mockGetCurrentWebAppEntry.mockRejectedValue(
      new Error('Auth service unavailable')
    );
    await expect(validateGuestSession(headers)).rejects.toMatchObject({
      message: 'Auth service unavailable',
    });
  });
});

describe('authMiddleware (createMiddleware wrapper)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetRequestHeaders.mockReturnValue(new Headers({ cookie: 'test' }));
  });

  it('calls next on successful auth validation', async () => {
    mockRequireWebAppEntry.mockResolvedValue({
      kind: 'canEnterWebApp',
      activeWorkspaceId: 'ws-1',
      capabilities: { canEnterWebApp: true },
    });
    const mockNext = vi.fn().mockResolvedValue('next-result');

    const serverFn = capturedServerFns['middleware_0'];
    const result = await serverFn({ next: mockNext });

    expect(mockGetRequestHeaders).toHaveBeenCalled();
    expect(mockNext).toHaveBeenCalled();
    expect(result).toBe('next-result');
  });

  it('propagates auth validation errors', async () => {
    mockRequireWebAppEntry.mockRejectedValue(
      expect.objectContaining({
        options: expect.objectContaining({ to: '/signin' }),
      })
    );
    const mockNext = vi.fn();

    const serverFn = capturedServerFns['middleware_0'];
    await expect(serverFn({ next: mockNext })).rejects.toBeTruthy();
    expect(mockNext).not.toHaveBeenCalled();
  });
});

describe('guestMiddleware (createMiddleware wrapper)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetRequestHeaders.mockReturnValue(new Headers({ cookie: 'test' }));
  });

  it('calls next for guest visitors', async () => {
    mockGetCurrentWebAppEntry.mockResolvedValue({
      kind: 'redirect',
      to: '/signin',
      capabilities: { mustSignIn: true },
    });
    const mockNext = vi.fn().mockResolvedValue('next-result');

    const serverFn = capturedServerFns['middleware_1'];
    const result = await serverFn({ next: mockNext });

    expect(mockNext).toHaveBeenCalled();
    expect(result).toBe('next-result');
  });

  it('propagates redirect for non-guest entry states', async () => {
    mockGetCurrentWebAppEntry.mockResolvedValue({
      kind: 'canEnterWebApp',
      activeWorkspaceId: 'ws-1',
      capabilities: { canEnterWebApp: true },
    });
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
