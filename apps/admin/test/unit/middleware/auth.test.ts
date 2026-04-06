// src/middleware/auth.test.ts
import { createMockSessionResponse } from '@workspace/test-utils';
import { createMiddlewareMock } from '../../mocks/middleware';
import type { CapturedServerFns } from '../../mocks/middleware';
import { validateAuthSession, validateGuestSession } from '@/middleware/auth';

const {
  mockGetAuth,
  mockGetVerifiedAdminSession,
  mockValidateGuest,
  mockGetRequestHeaders,
  capturedServerFns,
} = vi.hoisted(() => ({
  mockGetAuth: vi.fn(),
  mockGetVerifiedAdminSession: vi.fn(),
  mockValidateGuest: vi.fn(),
  mockGetRequestHeaders: vi.fn(() => new Headers({ cookie: 'test' })),
  capturedServerFns: {} as CapturedServerFns,
}));

vi.mock('@/init', () => ({
  getAuth: mockGetAuth,
}));

vi.mock('@/auth/validators', () => ({
  getVerifiedAdminSession: mockGetVerifiedAdminSession,
  validateGuestSession: mockValidateGuest,
}));

vi.mock('@tanstack/react-start/server', () => ({
  getRequestHeaders: mockGetRequestHeaders,
}));

vi.mock('@tanstack/react-start', () => createMiddlewareMock(capturedServerFns));

describe('validateAuthSession', () => {
  const headers = new Headers({ cookie: 'test' });

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAuth.mockReturnValue({ api: {} });
  });

  it('calls getVerifiedAdminSession and returns the result', async () => {
    const session = createMockSessionResponse();
    mockGetVerifiedAdminSession.mockResolvedValue(session);
    const auth = { api: {} };
    mockGetAuth.mockReturnValue(auth);

    const result = await validateAuthSession(headers);

    expect(mockGetVerifiedAdminSession).toHaveBeenCalledWith(headers, auth);
    expect(result).toEqual(session);
  });

  it('throws redirect when getVerifiedAdminSession throws (no session)', async () => {
    mockGetVerifiedAdminSession.mockRejectedValue(
      Object.assign(new Error(), {
        options: { to: '/signin' },
      })
    );
    await expect(validateAuthSession(headers)).rejects.toEqual(
      expect.objectContaining({
        options: expect.objectContaining({ to: '/signin' }),
      })
    );
  });

  it('handles getVerifiedAdminSession throwing an error', async () => {
    mockGetVerifiedAdminSession.mockRejectedValue(
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
    mockGetAuth.mockReturnValue({ api: {} });
  });

  it('returns without throwing when validateGuestSession succeeds', async () => {
    mockValidateGuest.mockResolvedValue(undefined);
    await expect(validateGuestSession(headers)).resolves.toBeUndefined();
  });

  it('throws redirect when authenticated admin exists', async () => {
    mockValidateGuest.mockRejectedValue(
      Object.assign(new Error(), {
        options: { to: '/dashboard' },
      })
    );
    await expect(validateGuestSession(headers)).rejects.toEqual(
      expect.objectContaining({
        options: expect.objectContaining({ to: '/dashboard' }),
      })
    );
  });

  it('handles validateGuestSession throwing an error', async () => {
    mockValidateGuest.mockRejectedValue(new Error('Auth service unavailable'));
    await expect(validateGuestSession(headers)).rejects.toMatchObject({
      message: 'Auth service unavailable',
    });
  });
});

describe('authMiddleware (createMiddleware wrapper)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetRequestHeaders.mockReturnValue(new Headers({ cookie: 'test' }));
    mockGetAuth.mockReturnValue({ api: {} });
  });

  it('calls next on successful auth validation', async () => {
    const session = createMockSessionResponse();
    mockGetVerifiedAdminSession.mockResolvedValue(session);
    const mockNext = vi.fn().mockResolvedValue('next-result');

    const serverFn = capturedServerFns['middleware_0'];
    const result = await serverFn({ next: mockNext });

    expect(mockGetRequestHeaders).toHaveBeenCalled();
    expect(mockNext).toHaveBeenCalled();
    expect(result).toBe('next-result');
  });

  it('propagates auth validation errors', async () => {
    mockGetVerifiedAdminSession.mockRejectedValue(new Error('Forbidden'));
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
    mockGetAuth.mockReturnValue({ api: {} });
  });

  it('calls next for guest visitors', async () => {
    mockValidateGuest.mockResolvedValue(undefined);
    const mockNext = vi.fn().mockResolvedValue('next-result');

    const serverFn = capturedServerFns['middleware_1'];
    const result = await serverFn({ next: mockNext });

    expect(mockNext).toHaveBeenCalled();
    expect(result).toBe('next-result');
  });

  it('propagates redirect for authenticated admin users', async () => {
    mockValidateGuest.mockRejectedValue(
      Object.assign(new Error(), {
        options: { to: '/dashboard' },
      })
    );
    const mockNext = vi.fn();

    const serverFn = capturedServerFns['middleware_1'];
    await expect(serverFn({ next: mockNext })).rejects.toEqual(
      expect.objectContaining({
        options: expect.objectContaining({ to: '/dashboard' }),
      })
    );
    expect(mockNext).not.toHaveBeenCalled();
  });
});
