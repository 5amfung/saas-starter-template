import { createServerFn } from '@tanstack/react-start';
import { getRequestHeaders } from '@tanstack/react-start/server';
import { redirect } from '@tanstack/react-router';
import * as z from 'zod';
import { auth } from '@/init';
import { requireWorkspaceCapabilityForUser } from '@/policy/workspace-capabilities.server';

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

const cancelInvitationInput = workspaceIdInput.extend({
  invitationId: z.string().min(1),
});

async function requireVerifiedSession(headers: Headers) {
  const session = await auth.api.getSession({ headers });
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

    return auth.api.createInvitation({
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

    return auth.api.cancelInvitation({
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

    return auth.api.removeMember({
      body: {
        memberIdOrEmail: data.memberId,
        organizationId: data.workspaceId,
      },
      headers,
    });
  });
