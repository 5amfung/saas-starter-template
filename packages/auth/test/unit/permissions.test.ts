import { describe, expect, it } from 'vitest';
import { ORGANIZATION_DEFAULT_ROLES } from '../../src/permissions';

describe('permissions', () => {
  it('ORGANIZATION_DEFAULT_ROLES contains owner, admin, and member', () => {
    expect(ORGANIZATION_DEFAULT_ROLES).toEqual(['owner', 'admin', 'member']);
  });
});
