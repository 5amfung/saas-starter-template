import { APIError } from 'better-auth/api';
import { isRecord } from '@workspace/auth';
import { auth } from '@/init';
import { pickDefaultWorkspace } from '@/workspace/workspace';

const getActiveOrganizationId = (session: unknown): string | null => {
  if (!isRecord(session)) return null;
  if (
    isRecord(session.session) &&
    typeof session.session.activeOrganizationId === 'string'
  ) {
    return session.session.activeOrganizationId;
  }
  return null;
};

export async function listUserWorkspaces(headers: Headers) {
  return auth.api.listOrganizations({ headers });
}

export async function ensureActiveWorkspaceForSession(
  headers: Headers,
  session: {
    user: {
      id: string;
    };
    session?: {
      activeOrganizationId?: string | null;
    };
  }
) {
  const workspaces = await listUserWorkspaces(headers);
  const activeOrganizationId = getActiveOrganizationId(session);
  const activeWorkspace =
    activeOrganizationId === null
      ? null
      : (workspaces.find(
          (workspace) => workspace.id === activeOrganizationId
        ) ?? null);
  if (activeWorkspace) return activeWorkspace;

  const targetWorkspace = pickDefaultWorkspace(workspaces, session.user.id);
  if (!targetWorkspace) {
    throw new APIError('INTERNAL_SERVER_ERROR', {
      message: 'Personal workspace is missing for this user.',
    });
  }

  await auth.api.setActiveOrganization({
    body: { organizationId: targetWorkspace.id },
    headers,
  });

  return targetWorkspace;
}

export async function ensureWorkspaceMembership(
  headers: Headers,
  workspaceId: string
) {
  const workspaces = await listUserWorkspaces(headers);
  const workspace = workspaces.find(
    (candidate) => candidate.id === workspaceId
  );
  if (!workspace) {
    throw new APIError('NOT_FOUND', {
      message: 'Workspace not found.',
    });
  }

  return workspace;
}
