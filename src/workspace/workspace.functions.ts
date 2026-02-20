import { notFound, redirect } from '@tanstack/react-router';
import { createServerFn } from '@tanstack/react-start';
import { getRequestHeaders } from '@tanstack/react-start/server';
import * as z from 'zod';
import { auth } from '@/auth/auth.server';
import {
  ensureActiveWorkspaceForSession,
  ensureWorkspaceMembership,
} from '@/workspace/workspace.server';

const workspaceRouteInput = z.object({
  workspaceId: z.string().min(1),
});

export const ensureWorkspaceRouteAccess = createServerFn()
  .inputValidator(workspaceRouteInput)
  .handler(async ({ data }) => {
    const headers = getRequestHeaders();
    const session = await auth.api.getSession({ headers });
    if (!session || !session.user.emailVerified) {
      throw redirect({ to: '/signin' });
    }

    await ensureActiveWorkspaceForSession(headers, {
      user: { id: session.user.id },
      session: session.session,
    });

    try {
      await ensureWorkspaceMembership(headers, session.user.id, data.workspaceId);
    } catch {
      throw notFound();
    }

    const activeOrganizationId =
      typeof (
        session.session as {
          activeOrganizationId?: unknown;
        }
      ).activeOrganizationId === 'string'
        ? (session.session as { activeOrganizationId: string }).activeOrganizationId
        : null;

    if (activeOrganizationId !== data.workspaceId) {
      await auth.api.setActiveOrganization({
        body: { organizationId: data.workspaceId },
        headers,
      });
    }

    return { workspaceId: data.workspaceId };
  });

export const getActiveWorkspace = createServerFn().handler(async () => {
  const headers = getRequestHeaders();
  const session = await auth.api.getSession({ headers });
  if (!session || !session.user.emailVerified) {
    throw redirect({ to: '/signin' });
  }

  const workspace = await ensureActiveWorkspaceForSession(headers, {
    user: { id: session.user.id },
    session: session.session,
  });

  return workspace;
});
