import { APIError } from 'better-auth/api';
import { auth } from '@/auth/auth.server';
import type { WorkspaceMetadata } from '@/workspace/workspace';
import {
  isPersonalWorkspaceOwnedByUser,
  parseWorkspaceMetadata,
  pickDefaultWorkspace,
} from '@/workspace/workspace';

type Workspace = {
  id: string;
  name: string;
  metadata?: WorkspaceMetadata | null;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const toWorkspaceMetadata = (value: unknown): WorkspaceMetadata => {
  return parseWorkspaceMetadata(value);
};

const toWorkspace = (value: unknown): Workspace | null => {
  if (!isRecord(value)) return null;
  const id = value.id;
  const name = value.name;
  if (typeof id !== 'string' || typeof name !== 'string') return null;
  return {
    id,
    name,
    metadata: toWorkspaceMetadata(value.metadata),
  };
};

const normalizeWorkspaceList = (value: unknown): Array<Workspace> => {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value
      .map((item) => toWorkspace(item))
      .filter((item): item is Workspace => item !== null);
  }
  if (isRecord(value) && Array.isArray(value.organizations)) {
    return value.organizations
      .map((item) => toWorkspace(item))
      .filter((item): item is Workspace => item !== null);
  }
  return [];
};

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

export async function listUserWorkspaces(
  headers: Headers,
): Promise<Array<Workspace>> {
  const data = await auth.api.listOrganizations({ headers });
  return normalizeWorkspaceList(data);
}

export function findPersonalWorkspace(
  workspaces: Array<Workspace>,
  userId: string,
): Workspace | null {
  return (
    workspaces.find((workspace) =>
      isPersonalWorkspaceOwnedByUser(workspace.metadata, userId),
    ) ?? null
  );
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
  },
): Promise<Workspace> {
  const workspaces = await listUserWorkspaces(headers);
  const activeOrganizationId = getActiveOrganizationId(session);
  const activeWorkspace =
    activeOrganizationId === null
      ? null
      : (workspaces.find(
          (workspace) => workspace.id === activeOrganizationId,
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
  userId: string,
  workspaceId: string,
): Promise<Workspace> {
  const workspaces = await listUserWorkspaces(headers);
  const workspace = workspaces.find(
    (candidate) => candidate.id === workspaceId,
  );
  if (!workspace) {
    throw new APIError('NOT_FOUND', {
      message: 'Workspace not found.',
    });
  }

  const personalWorkspace = findPersonalWorkspace(workspaces, userId);
  if (!personalWorkspace) {
    throw new APIError('INTERNAL_SERVER_ERROR', {
      message: 'Personal workspace is missing for this user.',
    });
  }

  return workspace;
}
