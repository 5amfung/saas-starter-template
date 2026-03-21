import { describe, expect, it } from 'vitest';
import {
  CUSTOM_PERMISSION_STATEMENTS,
  ORGANIZATION_DEFAULT_ROLES,
} from '../../src/permissions';

describe('permissions', () => {
  it('ORGANIZATION_DEFAULT_ROLES contains owner, admin, and member', () => {
    expect(ORGANIZATION_DEFAULT_ROLES).toEqual(['owner', 'admin', 'member']);
  });

  it('CUSTOM_PERMISSION_STATEMENTS is an empty object', () => {
    expect(CUSTOM_PERMISSION_STATEMENTS).toEqual({});
  });
});
