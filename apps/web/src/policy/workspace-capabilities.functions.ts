import { createServerFn } from '@tanstack/react-start';
import { getRequestHeaders } from '@tanstack/react-start/server';
import { redirect } from '@tanstack/react-router';
import * as z from 'zod';
import {
  getWorkspaceAccessCapabilitiesForUser,
  getWorkspaceCapabilitiesForUser,
} from './workspace-capabilities.server';
import { auth } from '@/init';

const workspaceCapabilitiesInput = z.object({
  workspaceId: z.string().min(1),
});

export const getWorkspaceCapabilities = createServerFn()
  .inputValidator(workspaceCapabilitiesInput)
  .handler(async ({ data }) => {
    const headers = getRequestHeaders();
    const session = await auth.api.getSession({ headers });
    if (!session || !session.user.emailVerified) {
      throw redirect({ to: '/signin' });
    }
    return getWorkspaceCapabilitiesForUser(
      headers,
      data.workspaceId,
      session.user.id
    );
  });

export const getWorkspaceAccessCapabilities = createServerFn()
  .inputValidator(workspaceCapabilitiesInput)
  .handler(async ({ data }) => {
    const headers = getRequestHeaders();
    const session = await auth.api.getSession({ headers });
    if (!session || !session.user.emailVerified) {
      throw redirect({ to: '/signin' });
    }

    return getWorkspaceAccessCapabilitiesForUser(
      headers,
      data.workspaceId,
      session.user.id
    );
  });
