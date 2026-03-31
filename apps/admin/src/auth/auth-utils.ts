export const isSignInPath = (path: string) =>
  path.startsWith('/sign-in') || path.startsWith('/callback/');

export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;
