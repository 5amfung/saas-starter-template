import * as z from 'zod';

const WORKSPACE_API_KEY_NAME_MAX_LENGTH = 80;

export const entitlementOverrideSchema = z.object({
  workspaceId: z.string(),
  limits: z
    .object({
      members: z.number().int().min(-1).optional(),
      projects: z.number().int().min(-1).optional(),
      apiKeys: z.number().int().min(-1).optional(),
    })
    .strict()
    .optional(),
  features: z
    .object({
      sso: z.boolean().optional(),
      auditLogs: z.boolean().optional(),
      apiAccess: z.boolean().optional(),
      prioritySupport: z.boolean().optional(),
    })
    .optional(),
  quotas: z
    .object({
      storageGb: z.number().int().min(-1).optional(),
      apiCallsMonthly: z.number().int().min(-1).optional(),
    })
    .optional(),
  notes: z.string().optional(),
});

export const workspaceApiKeyCreateSchema = z
  .object({
    workspaceId: z.string(),
    name: z
      .string()
      .trim()
      .min(1, 'Key name is required.')
      .max(
        WORKSPACE_API_KEY_NAME_MAX_LENGTH,
        `Key name must be ${WORKSPACE_API_KEY_NAME_MAX_LENGTH} characters or fewer.`
      ),
  })
  .strict();

export const workspaceApiKeyDeleteSchema = z.object({
  workspaceId: z.string(),
  apiKeyId: z.string(),
});

export type EntitlementOverrideInput = z.infer<
  typeof entitlementOverrideSchema
>;

export type WorkspaceApiKeyCreateInput = z.infer<
  typeof workspaceApiKeyCreateSchema
>;

export type WorkspaceApiKeyDeleteInput = z.infer<
  typeof workspaceApiKeyDeleteSchema
>;
