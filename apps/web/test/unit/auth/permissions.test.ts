import { describe, expect, it } from 'vitest';
import {
  ORGANIZATION_DEFAULT_ROLES,
  organizationRoles,
  organizationStatements,
} from '@/auth/core/permissions';

describe('permissions', () => {
  it('ORGANIZATION_DEFAULT_ROLES contains owner, admin, and member', () => {
    expect(ORGANIZATION_DEFAULT_ROLES).toEqual(['owner', 'admin', 'member']);
  });

  it('defines apiKey access control statements', () => {
    expect(organizationStatements.apiKey).toEqual([
      'create',
      'read',
      'update',
      'delete',
    ]);
  });

  it('grants admin full apiKey permissions', () => {
    expect(organizationRoles.admin.statements.apiKey).toEqual([
      'create',
      'read',
      'update',
      'delete',
    ]);
  });

  it('keeps owner full apiKey permissions when roles are explicitly configured', () => {
    expect(organizationRoles.owner.statements.apiKey).toEqual([
      'create',
      'read',
      'update',
      'delete',
    ]);
  });

  it('grants member read-only apiKey permissions', () => {
    expect(organizationRoles.member.statements.apiKey).toEqual(['read']);
  });
});
