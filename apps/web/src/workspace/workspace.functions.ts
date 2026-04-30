import { redirect } from '@tanstack/react-router';
import { createServerFn } from '@tanstack/react-start';
import { getRequestHeaders } from '@tanstack/react-start/server';
import * as z from 'zod';
import { resolveWebAppEntryAccess } from '@/policy/web-app-entry.server';
import { getAuth } from '@/init.server';
import {
  ensureWorkspaceMembership,
  getActiveMemberRole,
  getWorkspaceSwitcherTriggerDetail as getWorkspaceSwitcherTriggerDetailServer,
} from '@/workspace/workspace.server';

const workspaceRouteInput = z.object({
  workspaceId: z.string().min(1),
});

const workspaceSwitcherTriggerDetailInput = workspaceRouteInput;

type WorkspaceRouteRedirect = {
  kind: 'redirect';
  to: '/signin' | '/verify';
};

type WorkspaceIndexRouteTarget =
  | WorkspaceRouteRedirect
  | {
      kind: 'blocked';
      reason: 'noAccessibleWorkspaces';
    }
  | {
      kind: 'workspace';
      workspaceId: string;
    };

type WorkspaceRouteAccess =
  | WorkspaceRouteRedirect
  | {
      kind: 'workspace';
      workspaceId: string;
      role: Awaited<ReturnType<typeof getActiveMemberRole>>;
    };

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

const getVerifiedSessionResult = async (
  headers: Headers
): Promise<
  WorkspaceRouteRedirect | { kind: 'session'; session: VerifiedSession }
> => {
  const session = await getAuth().api.getSession({ headers });
  if (!session || !session.user.emailVerified) {
    return { kind: 'redirect', to: '/signin' };
  }

  return { kind: 'session', session: session as VerifiedSession };
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
    const sessionResult = await getVerifiedSessionResult(headers);
    if (sessionResult.kind === 'redirect') {
      return sessionResult satisfies WorkspaceRouteRedirect;
    }

    const [workspace, role] = await Promise.all([
      resolveWorkspaceRouteAccess(
        headers,
        data.workspaceId,
        sessionResult.session
      ),
      getActiveMemberRole(
        headers,
        data.workspaceId,
        sessionResult.session.user.id
      ),
    ]);

    return {
      kind: 'workspace',
      workspaceId: workspace.id,
      role,
    } satisfies WorkspaceRouteAccess;
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

export const getWorkspaceIndexRouteTarget = createServerFn().handler(
  async () => {
    const headers = getRequestHeaders();
    const entry = await resolveWebAppEntryAccess(headers);

    if (entry.kind === 'redirect') {
      return {
        kind: 'redirect',
        to: entry.to,
      } satisfies WorkspaceIndexRouteTarget;
    }

    if (entry.kind === 'blocked') {
      return {
        kind: 'blocked',
        reason: entry.reason,
      } satisfies WorkspaceIndexRouteTarget;
    }

    return {
      kind: 'workspace',
      workspaceId: entry.activeWorkspaceId,
    } satisfies WorkspaceIndexRouteTarget;
  }
);

export const getWorkspaceSwitcherTriggerDetail = createServerFn()
  .inputValidator(workspaceSwitcherTriggerDetailInput)
  .handler(async ({ data }) => {
    const headers = getRequestHeaders();
    await requireVerifiedSession(headers);
    return getWorkspaceSwitcherTriggerDetailServer(headers, data.workspaceId);
  });
