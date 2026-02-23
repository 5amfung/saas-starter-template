import { pickDefaultWorkspace } from '@/workspace/workspace';

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

const hasActiveOrganization = (session: SessionLike): boolean =>
  typeof session.activeOrganizationId === 'string';

type ListOrganizationsFn = (params: {
  headers: Headers;
}) => Promise<Array<{ id: string; metadata?: Record<string, unknown> | null }>>;

type SetActiveOrganizationFn = (params: {
  body: { organizationId: string };
  headers: Headers;
}) => Promise<unknown>;

export async function ensurePostSignInActiveWorkspace(params: {
  userId: string;
  session: SessionLike;
  headers?: Headers;
  listOrganizations: ListOrganizationsFn;
  setActiveOrganization: SetActiveOrganizationFn;
}): Promise<void> {
  if (hasActiveOrganization(params.session)) return;
  if (!params.headers) return;

  try {
    const organizations = await params.listOrganizations({
      headers: params.headers,
    });
    const targetWorkspace = pickDefaultWorkspace(organizations, params.userId);

    if (!targetWorkspace) return;

    await params.setActiveOrganization({
      body: { organizationId: targetWorkspace.id },
      headers: params.headers,
    });
  } catch {
    return;
  }
}
