import { createServerFn } from '@tanstack/react-start';
import { getRequestHeaders } from '@tanstack/react-start/server';
import { redirect } from '@tanstack/react-router';
import * as z from 'zod';
import { getWorkspaceLifecycleCapabilitiesForUser } from './workspace-lifecycle-capabilities.server';
import { auth } from '@/init';

const workspaceLifecycleInput = z.object({
  workspaceId: z.string().min(1),
});

export const getWorkspaceLifecycleCapabilities = createServerFn()
  .inputValidator(workspaceLifecycleInput)
  .handler(async ({ data }) => {
    const headers = getRequestHeaders();
    const session = await auth.api.getSession({ headers });
    if (!session || !session.user.emailVerified) {
      throw redirect({ to: '/signin' });
    }

    return getWorkspaceLifecycleCapabilitiesForUser(
      headers,
      data.workspaceId,
      session.user.id
    );
  });
