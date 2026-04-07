import { APIError } from 'better-auth/api';
import { isRecord } from '@workspace/auth';
import { getAuth } from '@/init';
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
  return listAccessibleWorkspaces(headers);
}

export async function listAccessibleWorkspaces(headers: Headers) {
  return getAuth().api.listOrganizations({ headers });
}

export async function countOwnedWorkspaces(headers: Headers, userId: string) {
  await getAuth().api.getSession({ headers });
  return getAuth().billing.countOwnedWorkspaces(userId);
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
  const workspaces = await listAccessibleWorkspaces(headers);
  const targetWorkspace = await resolvePreferredWorkspace(
    headers,
    session,
    workspaces
  );
  if (!targetWorkspace) {
    throw new APIError('INTERNAL_SERVER_ERROR', {
      message: 'No workspace found for this user.',
    });
  }

  if (getActiveOrganizationId(session) !== targetWorkspace.id) {
    await getAuth().api.setActiveOrganization({
      body: { organizationId: targetWorkspace.id },
      headers,
    });
  }

  return targetWorkspace;
}

export async function resolvePreferredWorkspace(
  headers: Headers,
  session: {
    session?: {
      activeOrganizationId?: string | null;
    };
  },
  workspaces?: Array<{ id: string }>
) {
  const accessibleWorkspaces =
    workspaces ?? (await listAccessibleWorkspaces(headers));
  const activeOrganizationId = getActiveOrganizationId(session);
  const activeWorkspace =
    activeOrganizationId === null
      ? null
      : (accessibleWorkspaces.find(
          (workspace) => workspace.id === activeOrganizationId
        ) ?? null);

  if (activeWorkspace) {
    return activeWorkspace;
  }

  return pickDefaultWorkspace(accessibleWorkspaces);
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
    const organization = await getAuth().api.getFullOrganization({
      headers,
      query: { organizationId: workspaceId },
    });
    if (organization) {
      return organization;
    }

    throw new APIError('NOT_FOUND', {
      message: 'Workspace not found.',
    });
  }

  return workspace;
}

export async function getActiveMemberRole(
  headers: Headers,
  workspaceId: string,
  userId: string
): Promise<string | null> {
  const organization = await getAuth().api.getFullOrganization({
    headers,
    query: { organizationId: workspaceId },
  });
  if (!organization) return null;

  const member = organization.members.find((m) => m.userId === userId);
  return member?.role ?? null;
}

export async function getWorkspaceMemberById(
  headers: Headers,
  workspaceId: string,
  memberId: string
) {
  const organization = await getAuth().api.getFullOrganization({
    headers,
    query: { organizationId: workspaceId },
  });
  if (!organization) return null;

  return organization.members.find((member) => member.id === memberId) ?? null;
}
