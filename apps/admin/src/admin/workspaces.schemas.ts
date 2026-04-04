import * as z from 'zod';

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

export type EntitlementOverrideInput = z.infer<
  typeof entitlementOverrideSchema
>;
