import { redirect } from '@tanstack/react-router';
import { createServerFn } from '@tanstack/react-start';
import { getRequestHeaders } from '@tanstack/react-start/server';
import * as z from 'zod';
import { requireWebAppEntry } from '@/policy/web-app-entry.server';
import { getAuth } from '@/init';
import {
  ensureWorkspaceMembership,
  getActiveMemberRole,
} from '@/workspace/workspace.server';

const workspaceRouteInput = z.object({
  workspaceId: z.string().min(1),
});

type VerifiedSession = NonNullable<
  Awaited<ReturnType<ReturnType<typeof getAuth>['api']['getSession']>>
>;

const requireVerifiedSession = async (headers: Headers) => {
  const session = await getAuth().api.getSession({ headers });
  if (!session || !session.user.emailVerified) {
    throw redirect({ to: '/signin' });
  }

  return session as VerifiedSession;
};

const resolveWorkspaceRouteAccess = async (
  headers: Headers,
  workspaceId: string,
  session: VerifiedSession
) => {
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
    await getAuth().api.setActiveOrganization({
      body: { organizationId: workspaceId },
      headers,
    });
  }

  return workspace;
};

export const getWorkspaceById = createServerFn()
  .inputValidator(workspaceRouteInput)
  .handler(async ({ data }) => {
    const headers = getRequestHeaders();
    const session = await requireVerifiedSession(headers);

    return resolveWorkspaceRouteAccess(headers, data.workspaceId, session);
  });

export const getWorkspaceWithRole = createServerFn()
  .inputValidator(workspaceRouteInput)
  .handler(async ({ data }) => {
    const headers = getRequestHeaders();
    const session = await requireVerifiedSession(headers);

    const [workspace, role] = await Promise.all([
      resolveWorkspaceRouteAccess(headers, data.workspaceId, session),
      getActiveMemberRole(headers, data.workspaceId, session.user.id),
    ]);

    return { workspace, role };
  });

export const getWorkspaceRouteAccess = createServerFn()
  .inputValidator(workspaceRouteInput)
  .handler(async ({ data }) => {
    const headers = getRequestHeaders();
    const session = await requireVerifiedSession(headers);

    const [workspace, role] = await Promise.all([
      resolveWorkspaceRouteAccess(headers, data.workspaceId, session),
      getActiveMemberRole(headers, data.workspaceId, session.user.id),
    ]);

    return {
      workspaceId: workspace.id,
      role,
    };
  });

export const ensureWorkspaceRouteAccess = createServerFn()
  .inputValidator(workspaceRouteInput)
  .handler(async ({ data }) => {
    const headers = getRequestHeaders();
    const session = await requireVerifiedSession(headers);
    const workspace = await resolveWorkspaceRouteAccess(
      headers,
      data.workspaceId,
      session
    );
    return { workspaceId: workspace.id };
  });

export const getActiveWorkspaceId = createServerFn().handler(async () => {
  const headers = getRequestHeaders();
  const entry = await requireWebAppEntry(headers);
  return entry.activeWorkspaceId;
});
