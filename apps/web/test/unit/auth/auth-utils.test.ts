import { describe, expect, it } from 'vitest';
import {
  isDuplicateOrganizationError,
  isRecord,
  isSignInPath,
} from '@/auth/core/auth-utils';

describe('isSignInPath', () => {
  it.each(['/sign-in', '/sign-in/email', '/callback/', '/callback/google'])(
    'returns true for %s',
    (path) => {
      expect(isSignInPath(path)).toBe(true);
    }
  );

  it.each(['/', '/signup', '/settings', '/sign-out', ''])(
    'returns false for %s',
    (path) => {
      expect(isSignInPath(path)).toBe(false);
    }
  );
});

describe('isDuplicateOrganizationError', () => {
  it.each([
    'Organization already exists',
    'duplicate key value',
    'UNIQUE constraint failed',
  ])('returns true for Error with message: "%s"', (message) => {
    expect(isDuplicateOrganizationError(new Error(message))).toBe(true);
  });

  it('returns false for Error with unrelated message', () => {
    expect(isDuplicateOrganizationError(new Error('not found'))).toBe(false);
  });

  it.each([null, undefined, 'already exists', { message: 'duplicate' }])(
    'returns false for non-Error value: %j',
    (value) => {
      expect(isDuplicateOrganizationError(value)).toBe(false);
    }
  );
});

describe('isRecord', () => {
  it.each([{}, { a: 1 }, { nested: { key: 'value' } }])(
    'returns true for plain objects: %j',
    (value) => {
      expect(isRecord(value)).toBe(true);
    }
  );

  it.each([null, undefined, 42, 'string', true])(
    'returns false for non-record values: %j',
    (value) => {
      expect(isRecord(value)).toBe(false);
    }
  );

  it('returns true for arrays (typeof object)', () => {
    expect(isRecord([1, 2])).toBe(true);
  });
});
