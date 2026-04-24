import { describe, expect, it } from 'vitest';

import {
  ADMIN_ACCESS_DENIED,
  ADMIN_DASHBOARD,
  ADMIN_ROOT,
  ADMIN_USERS,
  ADMIN_WORKSPACES,
} from '@/admin/admin-routes';

describe('admin route constants', () => {
  it('keeps all admin intent routes under /admin', () => {
    expect(ADMIN_ROOT).toBe('/admin');
    expect(ADMIN_ACCESS_DENIED).toBe('/admin/access-denied');
    expect(ADMIN_DASHBOARD).toBe('/admin/dashboard');
    expect(ADMIN_USERS).toBe('/admin/users');
    expect(ADMIN_WORKSPACES).toBe('/admin/workspaces');
  });
});
