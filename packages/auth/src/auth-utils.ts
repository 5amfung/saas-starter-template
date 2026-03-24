export const isSignInPath = (path: string) =>
  path.startsWith('/sign-in') || path.startsWith('/callback/');

export const isDuplicateOrganizationError = (error: unknown): boolean =>
  error instanceof Error &&
  (error.message.toLowerCase().includes('already exists') ||
    error.message.toLowerCase().includes('duplicate') ||
    error.message.toLowerCase().includes('unique'));

export type SessionLike = {
  activeOrganizationId?: unknown;
};

export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;
