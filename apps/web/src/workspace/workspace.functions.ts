import { redirect } from '@tanstack/react-router';
import { createServerFn } from '@tanstack/react-start';
import { getRequestHeaders } from '@tanstack/react-start/server';
import * as z from 'zod';
import { auth } from '@/init';
import {
  ensureActiveWorkspaceForSession,
  ensureWorkspaceMembership,
  getActiveMemberRole,
} from '@/workspace/workspace.server';

const workspaceRouteInput = z.object({
  workspaceId: z.string().min(1),
});

const resolveWorkspaceRouteAccess = async (workspaceId: string) => {
  const headers = getRequestHeaders();
  const session = await auth.api.getSession({ headers });
  if (!session || !session.user.emailVerified) {
    throw redirect({ to: '/signin' });
  }

  const workspace = await ensureWorkspaceMembership(headers, workspaceId);

  // After verifying membership above, switch to the workspace below.
  const activeOrganizationId =
    typeof (
      session.session as {
        activeOrganizationId?: unknown;
      }
    ).activeOrganizationId === 'string'
      ? (session.session as { activeOrganizationId: string })
          .activeOrganizationId
      : null;

  if (activeOrganizationId !== workspaceId) {
    await auth.api.setActiveOrganization({
      body: { organizationId: workspaceId },
      headers,
    });
  }

  return workspace;
};

export const getWorkspaceById = createServerFn()
  .inputValidator(workspaceRouteInput)
  .handler(async ({ data }) => resolveWorkspaceRouteAccess(data.workspaceId));

export const getWorkspaceWithRole = createServerFn()
  .inputValidator(workspaceRouteInput)
  .handler(async ({ data }) => {
    const headers = getRequestHeaders();
    const session = await auth.api.getSession({ headers });
    if (!session || !session.user.emailVerified) {
      throw redirect({ to: '/signin' });
    }

    const [workspace, role] = await Promise.all([
      resolveWorkspaceRouteAccess(data.workspaceId),
      getActiveMemberRole(headers, data.workspaceId, session.user.id),
    ]);

    return { workspace, role };
  });

export const ensureWorkspaceRouteAccess = createServerFn()
  .inputValidator(workspaceRouteInput)
  .handler(async ({ data }) => {
    const workspace = await resolveWorkspaceRouteAccess(data.workspaceId);
    return { workspaceId: workspace.id };
  });

export const getActiveWorkspaceId = createServerFn().handler(async () => {
  const headers = getRequestHeaders();
  const session = await auth.api.getSession({ headers });
  if (!session || !session.user.emailVerified) {
    throw redirect({ to: '/signin' });
  }

  const activeOrganizationId =
    (session.session as { activeOrganizationId?: string | null })
      .activeOrganizationId ?? null;
  if (activeOrganizationId) {
    return activeOrganizationId;
  }
  const workspace = await ensureActiveWorkspaceForSession(headers, {
    user: { id: session.user.id },
    session: session.session,
  });
  return workspace.id;
});
