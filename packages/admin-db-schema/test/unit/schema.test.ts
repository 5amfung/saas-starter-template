import {
  admin_user as adminUser,
  admin_session as session,
} from '../../src/auth.schema';
import { createDb } from '../../../db/src/index';
import * as schema from '../../src';

// ---------------------------------------------------------------------------
// auth.schema.ts — structural smoke tests
// ---------------------------------------------------------------------------

describe('auth schema tables', () => {
  describe('user table', () => {
    it.each([
      'id',
      'name',
      'email',
      'emailVerified',
      'role',
      'banned',
      'lastSignInAt',
    ] as const)('has %s column', (column) => {
      expect(adminUser[column]).toBeDefined();
    });

    it('has id as primary key', () => {
      expect(adminUser.id.primary).toBe(true);
    });

    it('has email as non-null', () => {
      expect(adminUser.email.notNull).toBe(true);
    });

    it('has name as non-null', () => {
      expect(adminUser.name.notNull).toBe(true);
    });
  });

  describe('session table', () => {
    it('has userId as non-null foreign key', () => {
      expect(session.userId.notNull).toBe(true);
    });
  });
});

// ---------------------------------------------------------------------------
// index.ts — exports
// ---------------------------------------------------------------------------

describe('db package exports', () => {
  it('exports createDb as a function', () => {
    expect(typeof createDb).toBe('function');
  });

  it('exports schema with auth and app tables', () => {
    expect(schema.admin_user).toBeDefined();
  });
});
