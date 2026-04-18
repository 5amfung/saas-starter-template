import { createServerFn } from '@tanstack/react-start';
import * as z from 'zod';
import { getWorkspaceLifecycleCapabilitiesForUser } from './workspace-lifecycle-capabilities.server';
import { requireVerifiedWebSession } from './policy-session.server';

const workspaceLifecycleInput = z.object({
  workspaceId: z.string().min(1),
});

export const getWorkspaceLifecycleCapabilities = createServerFn()
  .inputValidator(workspaceLifecycleInput)
  .handler(async ({ data }) => {
    const { headers, userId } = await requireVerifiedWebSession();

    return getWorkspaceLifecycleCapabilitiesForUser(
      headers,
      data.workspaceId,
      userId
    );
  });
