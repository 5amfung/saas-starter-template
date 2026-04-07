import { APIError } from 'better-auth/api';
import { redirect } from '@tanstack/react-router';
import { getRequestHeaders } from '@tanstack/react-start/server';
import {
  createEnteredWebAppEntry,
  resolveWebAppEntry,
} from './web-app-entry.shared';
import type { WebAppEntry, WebAppEntryAllowed } from './web-app-entry.shared';
import { getAuth } from '@/init';
import {
  listAccessibleWorkspaces,
  resolvePreferredWorkspace,
} from '@/workspace/workspace.server';

type RawSession = Awaited<
  ReturnType<ReturnType<typeof getAuth>['api']['getSession']>
>;

function getActiveWorkspaceId(session: RawSession): string | null {
  if (!session) return null;

  return typeof session.session.activeOrganizationId === 'string'
    ? session.session.activeOrganizationId
    : null;
}

export async function getCurrentWebAppEntry(
  headers: Headers = getRequestHeaders()
): Promise<WebAppEntry> {
  const session = await getAuth().api.getSession({ headers });

  if (!session) {
    return resolveWebAppEntry({
      hasSession: false,
      emailVerified: false,
      platformRole: null,
      activeWorkspaceId: null,
      accessibleWorkspaceCount: 0,
      preferredWorkspace: null,
    });
  }

  if (!session.user.emailVerified) {
    return resolveWebAppEntry({
      hasSession: true,
      emailVerified: false,
      platformRole: null,
      activeWorkspaceId: getActiveWorkspaceId(session),
      accessibleWorkspaceCount: 0,
      preferredWorkspace: null,
    });
  }

  const activeWorkspaceId = getActiveWorkspaceId(session);
  const accessibleWorkspaces = await listAccessibleWorkspaces(headers);
  const activeWorkspace =
    activeWorkspaceId === null
      ? null
      : (accessibleWorkspaces.find(
          (workspace) => workspace.id === activeWorkspaceId
        ) ?? null);
  const preferredWorkspace =
    activeWorkspace === null
      ? await resolvePreferredWorkspace(headers, session, accessibleWorkspaces)
      : null;

  return resolveWebAppEntry({
    hasSession: true,
    emailVerified: true,
    platformRole: null,
    activeWorkspaceId: activeWorkspace?.id ?? null,
    accessibleWorkspaceCount: accessibleWorkspaces.length,
    preferredWorkspace,
  });
}

export async function requireWebAppEntry(
  headers: Headers = getRequestHeaders()
): Promise<WebAppEntryAllowed> {
  const entry = await getCurrentWebAppEntry(headers);

  if (entry.kind === 'redirect') {
    throw redirect({ to: entry.to });
  }

  if (entry.kind === 'blocked') {
    throw new APIError('FORBIDDEN', {
      message: 'No accessible workspaces found for this user.',
    });
  }

  if (entry.kind === 'mustResolveWorkspace') {
    await getAuth().api.setActiveOrganization({
      body: { organizationId: entry.preferredWorkspace.id },
      headers,
    });

    return createEnteredWebAppEntry(entry.preferredWorkspace.id);
  }

  return entry;
}
