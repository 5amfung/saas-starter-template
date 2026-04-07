import { describe, expect, it, vi } from 'vitest';
import { getSessionOrNull, requireVerifiedSession } from '../../src/validators';

vi.mock('@tanstack/react-router', () => ({
  redirect: vi.fn((opts: unknown) => {
    throw opts;
  }),
}));

const mockSession = {
  user: {
    id: 'user-1',
    name: 'Test User',
    email: 'test@example.com',
    emailVerified: true,
    role: 'user',
  },
  session: { id: 'session-1' },
};

const createMockAuth = (session: unknown = mockSession) => ({
  api: { getSession: vi.fn().mockResolvedValue(session) },
});

describe('validators', () => {
  describe('getSessionOrNull', () => {
    it('returns the current session when authenticated', async () => {
      const auth = createMockAuth();
      const result = await getSessionOrNull(new Headers(), auth as never);
      expect(result).toEqual(mockSession);
    });

    it('returns null when unauthenticated', async () => {
      const auth = createMockAuth(null);
      await expect(
        getSessionOrNull(new Headers(), auth as never)
      ).resolves.toBeNull();
    });
  });

  describe('requireVerifiedSession', () => {
    it('returns session for verified user', async () => {
      const auth = createMockAuth();
      const result = await requireVerifiedSession(new Headers(), auth as never);
      expect(result).toEqual(mockSession);
    });

    it('redirects to /signin when session is null', async () => {
      const auth = createMockAuth(null);
      await expect(
        requireVerifiedSession(new Headers(), auth as never)
      ).rejects.toEqual(expect.objectContaining({ to: '/signin' }));
    });

    it('redirects to /signin when email is not verified', async () => {
      const auth = createMockAuth({
        user: { ...mockSession.user, emailVerified: false },
        session: mockSession.session,
      });
      await expect(
        requireVerifiedSession(new Headers(), auth as never)
      ).rejects.toEqual(expect.objectContaining({ to: '/signin' }));
    });
  });
});
