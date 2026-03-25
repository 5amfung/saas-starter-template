import * as React from 'react';

/**
 * Creates a mock for the GoogleSignInButton component.
 * Avoids OAuth setup in tests that render auth forms.
 */
export function createGoogleSignInButtonMock() {
  return {
    GoogleSignInButton: ({ callbackURL }: { callbackURL?: string }) =>
      React.createElement(
        'button',
        { 'data-callback-url': callbackURL },
        'Sign in with Google'
      ),
  };
}
