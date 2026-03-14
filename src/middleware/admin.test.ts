// src/middleware/admin.test.ts
import { createMockSessionResponse } from '@/test/factories';
import { validateAdminSession } from '@/middleware/admin';

const { mockGetSession } = vi.hoisted(() => ({
  mockGetSession: vi.fn(),
}));

vi.mock('@/auth/auth.server', () => ({
  auth: { api: { getSession: mockGetSession } },
}));

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
      }),
    );
  });

  it('throws redirect to /signin when emailVerified is false', async () => {
    mockGetSession.mockResolvedValue(
      createMockSessionResponse({ emailVerified: false }),
    );
    await expect(validateAdminSession(headers)).rejects.toEqual(
      expect.objectContaining({
        options: expect.objectContaining({ to: '/signin' }),
      }),
    );
  });

  it('throws redirect to /signin for non-admin role', async () => {
    mockGetSession.mockResolvedValue(
      createMockSessionResponse({ role: 'user' }),
    );
    await expect(validateAdminSession(headers)).rejects.toEqual(
      expect.objectContaining({
        options: expect.objectContaining({ to: '/signin' }),
      }),
    );
  });

  it('handles getSession throwing an error', async () => {
    mockGetSession.mockRejectedValue(new Error('Auth service unavailable'));
    await expect(validateAdminSession(headers)).rejects.toThrow(
      'Auth service unavailable',
    );
  });

  it('handles session with empty role string', async () => {
    mockGetSession.mockResolvedValue(createMockSessionResponse({ role: '' }));
    await expect(validateAdminSession(headers)).rejects.toEqual(
      expect.objectContaining({
        options: expect.objectContaining({ to: '/signin' }),
      }),
    );
  });

  it('returns session for admin with verified email', async () => {
    const session = createMockSessionResponse({ role: 'admin' });
    mockGetSession.mockResolvedValue(session);

    const result = await validateAdminSession(headers);
    expect(result).toEqual(session);
  });
});
