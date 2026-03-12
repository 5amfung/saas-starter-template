import { describe, expect, it } from 'vitest';
import {
  isDuplicateOrganizationError,
  isSignInPath,
} from './auth-hooks.server';

describe('isSignInPath', () => {
  it.each(['/sign-in', '/sign-in/email', '/callback/', '/callback/google'])(
    'returns true for %s',
    (path) => {
      expect(isSignInPath(path)).toBe(true);
    },
  );

  it.each(['/', '/signup', '/settings', '/sign-out', ''])(
    'returns false for %s',
    (path) => {
      expect(isSignInPath(path)).toBe(false);
    },
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
    },
  );
});
