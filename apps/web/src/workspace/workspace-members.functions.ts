import { APIError } from 'better-auth/api';
import { sql } from 'drizzle-orm';
import { createServerFn } from '@tanstack/react-start';
import { getRequestHeaders } from '@tanstack/react-start/server';
import { redirect } from '@tanstack/react-router';
import * as z from 'zod';
import { getAuth, getDb } from '@/init';
import { requireWorkspaceCapabilityForUser } from '@/policy/workspace-capabilities.server';
import {
  requireWorkspaceLeaveAllowedForUser,
  requireWorkspaceMemberRemovalAllowedForUser,
  requireWorkspaceOwnershipTransferAllowedForUser,
} from '@/policy/workspace-lifecycle-capabilities.server';
import {
  getWorkspaceMemberById,
  getWorkspaceMemberForUser,
} from '@/workspace/workspace.server';

const workspaceIdInput = z.object({
  workspaceId: z.string().min(1),
});

const inviteWorkspaceMemberInput = workspaceIdInput.extend({
  email: z.string().trim().email(),
  role: z.enum(['member', 'admin']),
  resend: z.boolean().optional(),
});

const removeWorkspaceMemberInput = workspaceIdInput.extend({
  memberId: z.string().min(1),
});

const transferWorkspaceOwnershipInput = workspaceIdInput.extend({
  memberId: z.string().min(1),
});

const cancelInvitationInput = workspaceIdInput.extend({
  invitationId: z.string().min(1),
});

async function requireVerifiedSession(headers: Headers) {
  const session = await getAuth().api.getSession({ headers });
  if (!session || !session.user.emailVerified) {
    throw redirect({ to: '/signin' });
  }

  return session;
}

export const inviteWorkspaceMember = createServerFn()
  .inputValidator(inviteWorkspaceMemberInput)
  .handler(async ({ data }) => {
    const headers = getRequestHeaders();
    const session = await requireVerifiedSession(headers);

    await requireWorkspaceCapabilityForUser(
      headers,
      data.workspaceId,
      session.user.id,
      'canInviteMembers'
    );

    return getAuth().api.createInvitation({
      body: {
        email: data.email,
        role: data.role,
        organizationId: data.workspaceId,
        ...(data.resend ? { resend: true } : {}),
      },
      headers,
    });
  });

export const cancelWorkspaceInvitation = createServerFn()
  .inputValidator(cancelInvitationInput)
  .handler(async ({ data }) => {
    const headers = getRequestHeaders();
    const session = await requireVerifiedSession(headers);

    await requireWorkspaceCapabilityForUser(
      headers,
      data.workspaceId,
      session.user.id,
      'canManageMembers'
    );

    return getAuth().api.cancelInvitation({
      body: { invitationId: data.invitationId },
      headers,
    });
  });

export const removeWorkspaceMember = createServerFn()
  .inputValidator(removeWorkspaceMemberInput)
  .handler(async ({ data }) => {
    const headers = getRequestHeaders();
    const session = await requireVerifiedSession(headers);

    await requireWorkspaceCapabilityForUser(
      headers,
      data.workspaceId,
      session.user.id,
      'canManageMembers'
    );

    await requireWorkspaceMemberRemovalAllowedForUser(
      headers,
      data.workspaceId,
      session.user.id,
      data.memberId
    );

    return getAuth().api.removeMember({
      body: {
        memberIdOrEmail: data.memberId,
        organizationId: data.workspaceId,
      },
      headers,
    });
  });

export const transferWorkspaceOwnership = createServerFn()
  .inputValidator(transferWorkspaceOwnershipInput)
  .handler(async ({ data }) => {
    const headers = getRequestHeaders();
    const session = await requireVerifiedSession(headers);

    await requireWorkspaceOwnershipTransferAllowedForUser(
      headers,
      data.workspaceId,
      session.user.id,
      data.memberId
    );

    const actorMember = await getWorkspaceMemberForUser(
      headers,
      data.workspaceId,
      session.user.id
    );

    if (!actorMember) {
      throw new APIError('NOT_FOUND', {
        message: 'Current workspace member not found.',
      });
    }

    const targetMember = await getWorkspaceMemberById(
      headers,
      data.workspaceId,
      data.memberId
    );

    if (!targetMember) {
      throw new APIError('NOT_FOUND', {
        message: 'Workspace member not found.',
      });
    }

    if (targetMember.role !== 'member' && targetMember.role !== 'admin') {
      throw new APIError('INTERNAL_SERVER_ERROR', {
        message: 'Workspace member has an unknown role.',
      });
    }

    if (actorMember.role !== 'owner') {
      throw new APIError('INTERNAL_SERVER_ERROR', {
        message: 'Current workspace member has an unknown role.',
      });
    }

    await getDb().transaction(async (tx) => {
      const targetAfterPromotion = await tx.execute(
        sql<{ id: string; role: string }>`
          update "member"
          set "role" = 'owner'
          where "id" = ${data.memberId}
            and "organization_id" = ${data.workspaceId}
            and "role" in ('member', 'admin')
          returning "id", "role"
        `
      );

      if (targetAfterPromotion.rows.length === 0) {
        throw new APIError('INTERNAL_SERVER_ERROR', {
          message: 'Workspace ownership transfer could not be started.',
        });
      }
      const promotedTarget = targetAfterPromotion.rows[0];

      const actorAfterDemotion = await tx.execute(
        sql<{ id: string; role: string }>`
          update "member"
          set "role" = 'admin'
          where "id" = ${actorMember.id}
            and "organization_id" = ${data.workspaceId}
            and "role" = 'owner'
          returning "id", "role"
        `
      );

      if (actorAfterDemotion.rows.length === 0) {
        throw new APIError('INTERNAL_SERVER_ERROR', {
          message: 'Workspace ownership transfer could not be completed.',
        });
      }
      const demotedActor = actorAfterDemotion.rows[0];

      const membersResult = await tx.execute(
        sql<{ id: string; role: string }>`
          select "id", "role"
          from "member"
          where "organization_id" = ${data.workspaceId}
        `
      );
      const members = membersResult.rows;

      const owners = members.filter((member) => member.role === 'owner');
      const actorAfter = members.find((member) => member.id === actorMember.id);
      const targetAfter = members.find((member) => member.id === data.memberId);

      if (
        promotedTarget.role !== 'owner' ||
        demotedActor.role !== 'admin' ||
        owners.length !== 1 ||
        owners[0]?.id !== data.memberId ||
        actorAfter?.role !== 'admin' ||
        targetAfter?.role !== 'owner'
      ) {
        throw new APIError('INTERNAL_SERVER_ERROR', {
          message:
            'Workspace ownership transfer could not be verified after update.',
        });
      }
    });

    return {
      workspaceId: data.workspaceId,
      memberId: data.memberId,
    };
  });

export const leaveWorkspace = createServerFn()
  .inputValidator(workspaceIdInput)
  .handler(async ({ data }) => {
    const headers = getRequestHeaders();
    const session = await requireVerifiedSession(headers);

    await requireWorkspaceLeaveAllowedForUser(
      headers,
      data.workspaceId,
      session.user.id
    );

    return getAuth().api.leaveOrganization({
      body: { organizationId: data.workspaceId },
      headers,
    });
  });
