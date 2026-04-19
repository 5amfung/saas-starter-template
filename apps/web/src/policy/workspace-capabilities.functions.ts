import { createServerFn } from '@tanstack/react-start';
import * as z from 'zod';
import {
  getWorkspaceCapabilitiesForUser,
  getWorkspaceRoleOnlyCapabilitiesForUser,
} from './workspace-capabilities.server';
import { requireVerifiedWebSession } from './policy-session.server';

const workspaceCapabilitiesInput = z.object({
  workspaceId: z.string().min(1),
});

/**
 * Returns the full workspace capability snapshot for the current user.
 * This includes role permissions plus richer facts like billing state and
 * workspace-count-dependent rules.
 */
export const getWorkspaceCapabilities = createServerFn()
  .inputValidator(workspaceCapabilitiesInput)
  .handler(async ({ data }) => {
    const { headers, userId } = await requireVerifiedWebSession();

    return getWorkspaceCapabilitiesForUser(headers, data.workspaceId, userId);
  });

/**
 * Returns the role-only workspace permission set for the current user.
 * This path depends only on membership and normalized workspace role.
 */
export const getWorkspaceRoleOnlyCapabilities = createServerFn()
  .inputValidator(workspaceCapabilitiesInput)
  .handler(async ({ data }) => {
    const { headers, userId } = await requireVerifiedWebSession();

    return getWorkspaceRoleOnlyCapabilitiesForUser(
      headers,
      data.workspaceId,
      userId
    );
  });
