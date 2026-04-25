import { z } from 'zod';

export const planActionSchema = z.enum([
  'current',
  'upgrade',
  'downgrade',
  'cancel',
  'contact_sales',
  'unavailable',
]);

export const subscriptionStateSchema = z.object({
  status: z.string().nullable(),
  stripeSubscriptionId: z.string().nullable(),
  stripeScheduleId: z.string().nullable(),
  periodEnd: z.date().nullable(),
  cancelAtPeriodEnd: z.boolean(),
  cancelAt: z.date().nullable(),
});

export const currentEntitlementsSchema = z.object({
  limits: z.object({
    members: z.number(),
    projects: z.number(),
    apiKeys: z.number(),
  }),
  features: z.object({
    sso: z.boolean(),
    auditLogs: z.boolean(),
    apiAccess: z.boolean(),
    prioritySupport: z.boolean(),
  }),
  quotas: z.object({
    storageGb: z.number(),
    apiCallsMonthly: z.number(),
  }),
});

export const planDefinitionSchema = z.object({
  id: z.enum(['free', 'starter', 'pro', 'enterprise']),
  name: z.string(),
  tier: z.number(),
  pricing: z
    .object({
      monthly: z.object({ price: z.number() }),
      annual: z.object({ price: z.number() }),
    })
    .nullable(),
  entitlements: currentEntitlementsSchema,
  stripeEnabled: z.boolean(),
  isEnterprise: z.boolean(),
});

export const workspaceBillingSnapshotSchema = z.object({
  workspaceId: z.string(),
  currentPlanId: z.enum(['free', 'starter', 'pro', 'enterprise']),
  currentEntitlements: currentEntitlementsSchema,
  subscriptionState: subscriptionStateSchema,
  catalogPlans: z.array(planDefinitionSchema),
  targetActionsByPlan: z.record(z.string(), planActionSchema),
  scheduledTargetPlanId: z
    .enum(['free', 'starter', 'pro', 'enterprise'])
    .nullable(),
  memberCount: z.number(),
});

export type WorkspaceBillingSnapshot = z.infer<
  typeof workspaceBillingSnapshotSchema
>;

export function parseWorkspaceBillingSnapshot(
  value: unknown
): WorkspaceBillingSnapshot {
  return workspaceBillingSnapshotSchema.parse(value);
}
