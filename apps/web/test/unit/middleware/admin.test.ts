// src/middleware/admin.test.ts
import { createMockSessionResponse } from '@workspace/test-utils';
import { createMiddlewareMock } from '../../mocks/middleware';
import type { CapturedServerFns } from '../../mocks/middleware';
import { validateAdminSession } from '@/middleware/admin';

const { mockGetSession, mockGetRequestHeaders, capturedServerFns } = vi.hoisted(
  () => ({
    mockGetSession: vi.fn(),
    mockGetRequestHeaders: vi.fn(() => new Headers({ cookie: 'test' })),
    capturedServerFns: {} as CapturedServerFns,
  })
);

vi.mock('@/init', () => ({
  auth: { api: { getSession: mockGetSession } },
}));

vi.mock('@tanstack/react-start/server', () => ({
  getRequestHeaders: mockGetRequestHeaders,
}));

vi.mock('@tanstack/react-start', () => createMiddlewareMock(capturedServerFns));

describe('validateAdminSession', () => {
  const headers = new Headers({ cookie: 'test' });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('throws redirect to /signin when no session exists', async () => {
    mockGetSession.mockResolvedValue(null);
    await expect(validateAdminSession(headers)).rejects.toEqual(
      expect.objectContaining({
        options: expect.objectContaining({ to: '/signin' }),
      })
    );
  });

  it('throws redirect to /signin when emailVerified is false', async () => {
    mockGetSession.mockResolvedValue(
      createMockSessionResponse({ emailVerified: false })
    );
    await expect(validateAdminSession(headers)).rejects.toEqual(
      expect.objectContaining({
        options: expect.objectContaining({ to: '/signin' }),
      })
    );
  });

  it('throws redirect to /signin for non-admin role', async () => {
    mockGetSession.mockResolvedValue(
      createMockSessionResponse({ role: 'user' })
    );
    await expect(validateAdminSession(headers)).rejects.toEqual(
      expect.objectContaining({
        options: expect.objectContaining({ to: '/signin' }),
      })
    );
  });

  it('handles getSession throwing an error', async () => {
    mockGetSession.mockRejectedValue(new Error('Auth service unavailable'));
    await expect(validateAdminSession(headers)).rejects.toThrow(
      'Auth service unavailable'
    );
  });

  it('handles session with empty role string', async () => {
    mockGetSession.mockResolvedValue(createMockSessionResponse({ role: '' }));
    await expect(validateAdminSession(headers)).rejects.toEqual(
      expect.objectContaining({
        options: expect.objectContaining({ to: '/signin' }),
      })
    );
  });

  it('returns session for admin with verified email', async () => {
    const session = createMockSessionResponse({ role: 'admin' });
    mockGetSession.mockResolvedValue(session);

    const result = await validateAdminSession(headers);
    expect(result).toEqual(session);
  });
});

describe('adminMiddleware (createMiddleware wrapper)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetRequestHeaders.mockReturnValue(new Headers({ cookie: 'test' }));
  });

  it('calls next for admin users', async () => {
    const session = createMockSessionResponse({ role: 'admin' });
    mockGetSession.mockResolvedValue(session);
    const mockNext = vi.fn().mockResolvedValue('next-result');

    const serverFn = capturedServerFns['middleware_0'];
    const result = await serverFn({ next: mockNext });

    expect(mockNext).toHaveBeenCalled();
    expect(result).toBe('next-result');
  });

  it('propagates redirect for non-admin users', async () => {
    mockGetSession.mockResolvedValue(null);
    const mockNext = vi.fn();

    const serverFn = capturedServerFns['middleware_0'];
    await expect(serverFn({ next: mockNext })).rejects.toThrow();
    expect(mockNext).not.toHaveBeenCalled();
  });
});
