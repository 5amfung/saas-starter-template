import { createServerFn } from '@tanstack/react-start';
import * as z from 'zod';
import {
  getWorkspaceAccessCapabilitiesForUser,
  getWorkspaceCapabilitiesForUser,
} from './workspace-capabilities.server';
import { requireVerifiedWebSession } from './policy-session.server';

const workspaceCapabilitiesInput = z.object({
  workspaceId: z.string().min(1),
});

export const getWorkspaceCapabilities = createServerFn()
  .inputValidator(workspaceCapabilitiesInput)
  .handler(async ({ data }) => {
    const { headers, userId } = await requireVerifiedWebSession();

    return getWorkspaceCapabilitiesForUser(headers, data.workspaceId, userId);
  });

export const getWorkspaceAccessCapabilities = createServerFn()
  .inputValidator(workspaceCapabilitiesInput)
  .handler(async ({ data }) => {
    const { headers, userId } = await requireVerifiedWebSession();

    return getWorkspaceAccessCapabilitiesForUser(
      headers,
      data.workspaceId,
      userId
    );
  });
