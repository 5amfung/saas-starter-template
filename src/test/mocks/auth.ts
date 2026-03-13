// src/test/mocks/auth.ts

/**
 * Creates hoisted auth mock functions for use with vi.mock('@/auth/auth-client').
 */
export function createAuthClientMocks() {
  const signInEmail = vi.fn();
  const signUpEmail = vi.fn();
  const getSession = vi.fn();
  const listAccounts = vi.fn();
  const listSessions = vi.fn();

  const authClient = {
    signIn: { email: signInEmail },
    signUp: { email: signUpEmail },
    getSession,
    listAccounts,
    listSessions,
    organization: {
      setActive: vi.fn(),
      list: vi.fn(),
    },
  };

  return {
    authClient,
    signInEmail,
    signUpEmail,
    getSession,
    listAccounts,
    listSessions,
  };
}
