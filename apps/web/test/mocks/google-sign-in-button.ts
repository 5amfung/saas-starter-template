import * as React from 'react';

/**
 * Creates a mock for the GoogleSignInButton component.
 * Avoids OAuth setup in tests that render auth forms.
 */
export function createGoogleSignInButtonMock() {
  return {
    GoogleSignInButton: () =>
      React.createElement('button', null, 'Sign in with Google'),
  };
}
