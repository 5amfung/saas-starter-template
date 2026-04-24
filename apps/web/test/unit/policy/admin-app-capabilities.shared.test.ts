import { describe, expect, it } from 'vitest';

import {
  getAdminAppEntryForSession,
  getAdminAppEntryRedirect,
} from '@/policy/admin-app-capabilities.shared';

describe('admin app entry policy', () => {
  it('requires sign-in without a session', () => {
    const entry = getAdminAppEntryForSession(null);

    expect(entry.kind).toBe('redirect');
    expect(getAdminAppEntryRedirect(entry, 'protected')).toEqual({
      to: '/signin',
      search: { redirect: '/admin/dashboard' },
    });
  });

  it('requires email verification for unverified users', () => {
    const entry = getAdminAppEntryForSession({
      user: { id: 'u1', emailVerified: false, role: 'admin' },
      session: { id: 's1' },
    });

    expect(entry.kind).toBe('redirect');
    expect(getAdminAppEntryRedirect(entry, 'protected')).toEqual({
      to: '/verify',
      search: { redirect: '/admin/dashboard' },
    });
  });

  it('denies verified non-admin users without sending them through sign-in', () => {
    const entry = getAdminAppEntryForSession({
      user: { id: 'u1', emailVerified: true, role: 'user' },
      session: { id: 's1' },
    });

    expect(entry.kind).toBe('accessDenied');
    expect(getAdminAppEntryRedirect(entry, 'protected')).toEqual({
      to: '/admin/access-denied',
    });
  });

  it('allows verified admin users', () => {
    const entry = getAdminAppEntryForSession({
      user: { id: 'u1', emailVerified: true, role: 'admin' },
      session: { id: 's1' },
    });

    expect(entry.kind).toBe('canEnterAdminApp');
    expect(getAdminAppEntryRedirect(entry, 'protected')).toBeNull();
  });
});
