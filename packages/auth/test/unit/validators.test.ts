// packages/auth/test/unit/validators.test.ts
import { describe, expect, it, vi } from 'vitest';
import {
  getVerifiedSession,
  validateAdminSession,
  validateGuestSession,
} from '../../src/validators';

// Validators accept auth as a parameter — no need to mock @/init.
// However, redirect() from @tanstack/react-router must be mocked so
// the thrown value is a plain object we can assert against.
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
  describe('getVerifiedSession', () => {
    it('returns session for verified user', async () => {
      const auth = createMockAuth();
      const result = await getVerifiedSession(new Headers(), auth as never);
      expect(result).toEqual(mockSession);
    });

    it('redirects to /signin when session is null', async () => {
      const auth = createMockAuth(null);
      await expect(
        getVerifiedSession(new Headers(), auth as never)
      ).rejects.toEqual(expect.objectContaining({ to: '/signin' }));
    });

    it('redirects to /signin when email is not verified', async () => {
      const auth = createMockAuth({
        user: { ...mockSession.user, emailVerified: false },
        session: mockSession.session,
      });
      await expect(
        getVerifiedSession(new Headers(), auth as never)
      ).rejects.toEqual(expect.objectContaining({ to: '/signin' }));
    });
  });

  describe('validateGuestSession', () => {
    it('redirects to /ws when user is authenticated and verified', async () => {
      const auth = createMockAuth();
      await expect(
        validateGuestSession(new Headers(), auth as never)
      ).rejects.toEqual(expect.objectContaining({ to: '/ws' }));
    });

    it('does nothing for unauthenticated user', async () => {
      const auth = createMockAuth(null);
      await expect(
        validateGuestSession(new Headers(), auth as never)
      ).resolves.toBeUndefined();
    });
  });

  describe('validateAdminSession', () => {
    it('returns session for admin user', async () => {
      const adminSession = {
        ...mockSession,
        user: { ...mockSession.user, role: 'admin' },
      };
      const auth = createMockAuth(adminSession);
      const result = await validateAdminSession(new Headers(), auth as never);
      expect(result).toEqual(adminSession);
    });

    it('redirects non-admin user', async () => {
      const auth = createMockAuth();
      await expect(
        validateAdminSession(new Headers(), auth as never)
      ).rejects.toEqual(expect.objectContaining({ to: '/signin' }));
    });

    it('redirects unverified admin', async () => {
      const auth = createMockAuth({
        user: { ...mockSession.user, role: 'admin', emailVerified: false },
        session: mockSession.session,
      });
      await expect(
        validateAdminSession(new Headers(), auth as never)
      ).rejects.toEqual(expect.objectContaining({ to: '/signin' }));
    });
  });
});
