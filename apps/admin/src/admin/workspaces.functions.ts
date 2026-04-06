import { createServerFn } from '@tanstack/react-start';
import * as z from 'zod';
import { requireCurrentAdminAppCapability } from '@/policy/admin-app-capabilities.server';
import {
  deleteEntitlementOverrides,
  getWorkspaceDetail,
  listWorkspacesWithPlan,
  upsertEntitlementOverrides,
} from '@/admin/workspaces.server';
import { entitlementOverrideSchema } from '@/admin/workspaces.schemas';

// --- List Workspaces ---

export const listWorkspaces = createServerFn()
  .inputValidator(
    z.object({
      search: z.string().optional(),
      filter: z.enum(['all', 'self-serve', 'enterprise']).optional(),
      offset: z.number().int().min(0).optional(),
      limit: z.number().int().min(1).max(100).optional(),
      sortBy: z.string().optional(),
      sortDirection: z.enum(['asc', 'desc']).optional(),
    })
  )
  .handler(async ({ data }) => {
    await requireCurrentAdminAppCapability('canViewWorkspaces');
    return listWorkspacesWithPlan(data);
  });

// --- Get Workspace ---

export const getWorkspace = createServerFn()
  .inputValidator(z.object({ workspaceId: z.string() }))
  .handler(async ({ data }) => {
    await requireCurrentAdminAppCapability('canViewWorkspaceBilling');
    return getWorkspaceDetail(data.workspaceId);
  });

// --- Save Entitlement Overrides ---

export const saveEntitlementOverrides = createServerFn()
  .inputValidator(entitlementOverrideSchema)
  .handler(async ({ data }) => {
    await requireCurrentAdminAppCapability('canManageEntitlementOverrides');
    await upsertEntitlementOverrides(data);
    return { success: true };
  });

// --- Clear Entitlement Overrides ---

export const clearEntitlementOverrides = createServerFn()
  .inputValidator(z.object({ workspaceId: z.string() }))
  .handler(async ({ data }) => {
    await requireCurrentAdminAppCapability('canManageEntitlementOverrides');
    await deleteEntitlementOverrides(data.workspaceId);
    return { success: true };
  });
