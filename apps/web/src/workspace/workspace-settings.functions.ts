import { createServerFn } from '@tanstack/react-start';
import { getRequestHeaders } from '@tanstack/react-start/server';
import { redirect } from '@tanstack/react-router';
import * as z from 'zod';
import { auth } from '@/init';
import { requireWorkspaceCapabilityForUser } from '@/policy/workspace-capabilities.server';

const workspaceSettingsInput = z.object({
  workspaceId: z.string().min(1),
});

const updateWorkspaceSettingsInput = workspaceSettingsInput.extend({
  name: z.string().trim().min(1),
});

async function requireVerifiedSession(headers: Headers) {
  const session = await auth.api.getSession({ headers });
  if (!session || !session.user.emailVerified) {
    throw redirect({ to: '/signin' });
  }

  return session;
}

export const updateWorkspaceSettings = createServerFn()
  .inputValidator(updateWorkspaceSettingsInput)
  .handler(async ({ data }) => {
    const headers = getRequestHeaders();
    const session = await requireVerifiedSession(headers);

    await requireWorkspaceCapabilityForUser(
      headers,
      data.workspaceId,
      session.user.id,
      'canManageSettings'
    );

    await auth.api.setActiveOrganization({
      body: { organizationId: data.workspaceId },
      headers,
    });

    return auth.api.updateOrganization({
      body: {
        data: {
          name: data.name,
        },
      },
      headers,
    });
  });

export const deleteWorkspace = createServerFn()
  .inputValidator(workspaceSettingsInput)
  .handler(async ({ data }) => {
    const headers = getRequestHeaders();
    const session = await requireVerifiedSession(headers);

    await requireWorkspaceCapabilityForUser(
      headers,
      data.workspaceId,
      session.user.id,
      'canDeleteWorkspace'
    );

    const organizations = await auth.api.listOrganizations({ headers });
    const nextWorkspaceId =
      organizations.find((organization) => organization.id !== data.workspaceId)
        ?.id ?? null;

    if (!nextWorkspaceId) {
      throw new Error('Failed to find an active workspace after deletion.');
    }

    await auth.api.deleteOrganization({
      body: { organizationId: data.workspaceId },
      headers,
    });

    await auth.api.setActiveOrganization({
      body: { organizationId: nextWorkspaceId },
      headers,
    });

    return { nextWorkspaceId };
  });
