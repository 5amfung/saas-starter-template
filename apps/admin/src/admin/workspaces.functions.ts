import { createServerFn } from '@tanstack/react-start';
import {
  OPERATIONS,
  buildWorkflowAttributes,
  startWorkflowSpan,
  workflowLogger,
} from '@workspace/logging/server';
import * as z from 'zod';
import { requireCurrentAdminAppCapability } from '@/policy/admin-app-capabilities.server';
import {
  createWorkspaceApiKey,
  deleteEntitlementOverrides,
  deleteWorkspaceApiKey,
  upsertEntitlementOverrides,
} from '@/admin/workspaces.server';
import {
  entitlementOverrideSchema,
  workspaceApiKeyCreateSchema,
  workspaceApiKeyDeleteSchema,
} from '@/admin/workspaces.schemas';

const ADMIN_WORKSPACE_ROUTE = '/workspaces/$workspaceId';

function buildAdminWorkspaceWorkflowAttributes(
  operation:
    | typeof OPERATIONS.ADMIN_WORKSPACE_API_KEY_CREATE
    | typeof OPERATIONS.ADMIN_WORKSPACE_API_KEY_DELETE
    | typeof OPERATIONS.ADMIN_WORKSPACE_ENTITLEMENTS_SAVE
    | typeof OPERATIONS.ADMIN_WORKSPACE_ENTITLEMENTS_CLEAR,
  attributes: {
    workspaceId: string;
    result: 'attempt' | 'success' | 'failure';
    failureCategory?: string;
  }
) {
  return buildWorkflowAttributes(operation, {
    route: ADMIN_WORKSPACE_ROUTE,
    ...attributes,
  });
}

// --- Save Entitlement Overrides ---

export const saveEntitlementOverrides = createServerFn()
  .inputValidator(entitlementOverrideSchema)
  .handler(async ({ data }) => {
    return startWorkflowSpan(
      {
        op: OPERATIONS.ADMIN_WORKSPACE_ENTITLEMENTS_SAVE,
        name: 'Save entitlement overrides',
        attributes: buildAdminWorkspaceWorkflowAttributes(
          OPERATIONS.ADMIN_WORKSPACE_ENTITLEMENTS_SAVE,
          {
            workspaceId: data.workspaceId,
            result: 'attempt',
          }
        ),
      },
      async () => {
        try {
          await requireCurrentAdminAppCapability(
            'canManageEntitlementOverrides'
          );
          await upsertEntitlementOverrides(data);
          workflowLogger.info('Admin entitlement overrides saved', {
            ...buildAdminWorkspaceWorkflowAttributes(
              OPERATIONS.ADMIN_WORKSPACE_ENTITLEMENTS_SAVE,
              {
                workspaceId: data.workspaceId,
                result: 'success',
              }
            ),
          });
          return { success: true as const };
        } catch (error) {
          workflowLogger.error('Admin entitlement overrides save failed', {
            ...buildAdminWorkspaceWorkflowAttributes(
              OPERATIONS.ADMIN_WORKSPACE_ENTITLEMENTS_SAVE,
              {
                workspaceId: data.workspaceId,
                result: 'failure',
                failureCategory: 'mutation_failed',
              }
            ),
          });
          throw error;
        }
      }
    );
  });

// --- Create Workspace API Key ---

export const createAdminWorkspaceApiKey = createServerFn()
  .inputValidator(workspaceApiKeyCreateSchema)
  .handler(async ({ data }) => {
    return startWorkflowSpan(
      {
        op: OPERATIONS.ADMIN_WORKSPACE_API_KEY_CREATE,
        name: 'Create workspace api key',
        attributes: buildAdminWorkspaceWorkflowAttributes(
          OPERATIONS.ADMIN_WORKSPACE_API_KEY_CREATE,
          {
            workspaceId: data.workspaceId,
            result: 'attempt',
          }
        ),
      },
      async () => {
        try {
          await requireCurrentAdminAppCapability('canPerformSupportActions');
          const result = await createWorkspaceApiKey(data);
          workflowLogger.info('Admin workspace api key created', {
            ...buildAdminWorkspaceWorkflowAttributes(
              OPERATIONS.ADMIN_WORKSPACE_API_KEY_CREATE,
              {
                workspaceId: data.workspaceId,
                result: 'success',
              }
            ),
            apiKeyId: result.id,
          });
          return {
            success: true as const,
            apiKeyId: result.id,
            generatedKey: result.key,
            keyStart: result.start,
            keyPrefix: result.prefix,
          };
        } catch (error) {
          workflowLogger.error('Admin workspace api key create failed', {
            ...buildAdminWorkspaceWorkflowAttributes(
              OPERATIONS.ADMIN_WORKSPACE_API_KEY_CREATE,
              {
                workspaceId: data.workspaceId,
                result: 'failure',
                failureCategory: 'mutation_failed',
              }
            ),
          });
          throw error;
        }
      }
    );
  });

// --- Delete Workspace API Key ---

export const deleteAdminWorkspaceApiKey = createServerFn()
  .inputValidator(workspaceApiKeyDeleteSchema)
  .handler(async ({ data }) => {
    return startWorkflowSpan(
      {
        op: OPERATIONS.ADMIN_WORKSPACE_API_KEY_DELETE,
        name: 'Delete workspace api key',
        attributes: buildAdminWorkspaceWorkflowAttributes(
          OPERATIONS.ADMIN_WORKSPACE_API_KEY_DELETE,
          {
            workspaceId: data.workspaceId,
            result: 'attempt',
          }
        ),
      },
      async () => {
        try {
          await requireCurrentAdminAppCapability('canPerformSupportActions');
          await deleteWorkspaceApiKey(data);
          workflowLogger.info('Admin workspace api key deleted', {
            ...buildAdminWorkspaceWorkflowAttributes(
              OPERATIONS.ADMIN_WORKSPACE_API_KEY_DELETE,
              {
                workspaceId: data.workspaceId,
                result: 'success',
              }
            ),
            apiKeyId: data.apiKeyId,
          });
          return { success: true as const };
        } catch (error) {
          workflowLogger.error('Admin workspace api key delete failed', {
            ...buildAdminWorkspaceWorkflowAttributes(
              OPERATIONS.ADMIN_WORKSPACE_API_KEY_DELETE,
              {
                workspaceId: data.workspaceId,
                result: 'failure',
                failureCategory: 'mutation_failed',
              }
            ),
            apiKeyId: data.apiKeyId,
          });
          throw error;
        }
      }
    );
  });

// --- Clear Entitlement Overrides ---

export const clearEntitlementOverrides = createServerFn()
  .inputValidator(z.object({ workspaceId: z.string() }))
  .handler(async ({ data }) => {
    return startWorkflowSpan(
      {
        op: OPERATIONS.ADMIN_WORKSPACE_ENTITLEMENTS_CLEAR,
        name: 'Clear entitlement overrides',
        attributes: buildAdminWorkspaceWorkflowAttributes(
          OPERATIONS.ADMIN_WORKSPACE_ENTITLEMENTS_CLEAR,
          {
            workspaceId: data.workspaceId,
            result: 'attempt',
          }
        ),
      },
      async () => {
        try {
          await requireCurrentAdminAppCapability(
            'canManageEntitlementOverrides'
          );
          await deleteEntitlementOverrides(data.workspaceId);
          workflowLogger.info('Admin entitlement overrides cleared', {
            ...buildAdminWorkspaceWorkflowAttributes(
              OPERATIONS.ADMIN_WORKSPACE_ENTITLEMENTS_CLEAR,
              {
                workspaceId: data.workspaceId,
                result: 'success',
              }
            ),
          });
          return { success: true as const };
        } catch (error) {
          workflowLogger.error('Admin entitlement overrides clear failed', {
            ...buildAdminWorkspaceWorkflowAttributes(
              OPERATIONS.ADMIN_WORKSPACE_ENTITLEMENTS_CLEAR,
              {
                workspaceId: data.workspaceId,
                result: 'failure',
                failureCategory: 'mutation_failed',
              }
            ),
          });
          throw error;
        }
      }
    );
  });
