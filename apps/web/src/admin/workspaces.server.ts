import { getRequestHeaders } from '@tanstack/react-start/server';
import { sql } from 'drizzle-orm';
import type {
  AdminWorkspaceListParams,
  EntitlementOverrides,
  Entitlements,
  PlanId,
  WorkspaceProductPolicy,
} from '@/billing/core';
import type {
  EntitlementOverrideInput,
  WorkspaceApiKeyCreateInput,
  WorkspaceApiKeyDeleteInput,
} from './workspaces.schemas';
import {
  clearAdminWorkspaceEntitlementOverrides,
  getAdminWorkspaceDetail,
  listAdminWorkspaces,
  setAdminWorkspaceEntitlementOverrides,
} from '@/billing/core';
import { getAuth, getDb } from '@/init.server';
import { requireCurrentAdminAppEntry } from '@/policy/admin-app-capabilities.server';

/** Verify the caller is an authenticated admin. Throws redirect otherwise. */
export async function requireAdmin() {
  const headers = getRequestHeaders();
  return requireCurrentAdminAppEntry(headers);
}

export type WorkspaceListParams = AdminWorkspaceListParams;

export interface WorkspaceRow {
  id: string;
  name: string;
  slug: string;
  createdAt: Date;
  ownerEmail: string | null;
  ownerName: string | null;
  planId: PlanId;
  planStatus: string | null;
  memberCount: number;
}

export interface WorkspaceListResult {
  workspaces: Array<WorkspaceRow>;
  total: number;
}

export interface WorkspaceDetail {
  id: string;
  name: string;
  slug: string;
  logo: string | null;
  createdAt: Date;
  ownerEmail: string | null;
  ownerName: string | null;
  ownerUserId: string | null;
  memberCount: number;
  planId: PlanId;
  entitlements: Entitlements;
  productPolicy: WorkspaceProductPolicy;
  subscription: {
    id: string;
    plan: string;
    status: string | null;
    stripeSubscriptionId: string | null;
    periodEnd: Date | null;
    cancelAtPeriodEnd: boolean | null;
  } | null;
  overrides: {
    id: string;
    limits: EntitlementOverrides['limits'];
    features: EntitlementOverrides['features'];
    quotas: EntitlementOverrides['quotas'];
    notes: string | null;
  } | null;
  apiKeys: Array<WorkspaceApiKeyRow>;
}

export interface WorkspaceApiKeyRow {
  id: string;
  name: string | null;
  start: string | null;
  prefix: string | null;
  configId: string;
  createdAt: Date;
}

export interface CreatedWorkspaceApiKey {
  id: string;
  key: string;
  start: string | null;
  prefix: string | null;
}

type WorkspaceApiKeySqlRow = Record<string, string | Date | null> &
  WorkspaceApiKeyRow;

const SYSTEM_MANAGED_API_KEY_CONFIG_ID = 'system-managed';
const WORKSPACE_API_KEY_PREFIX = 'sk_';

function getErrorMessage(error: unknown, fallback: string) {
  if (error && typeof error === 'object' && 'message' in error) {
    const message = error.message;
    if (typeof message === 'string' && message.length > 0) {
      return message;
    }
  }

  return fallback;
}

function unwrapBetterAuthResult<T>(result: unknown): T {
  if (
    result &&
    typeof result === 'object' &&
    'error' in result &&
    result.error
  ) {
    throw new Error(getErrorMessage(result.error, 'Admin operation failed.'));
  }

  if (result && typeof result === 'object' && 'data' in result) {
    return result.data as T;
  }

  return result as T;
}

export async function listWorkspaceApiKeys(
  workspaceId: string
): Promise<Array<WorkspaceApiKeyRow>> {
  const result = await getDb().execute<WorkspaceApiKeySqlRow>(
    sql`
      select
        id,
        name,
        start,
        prefix,
        config_id as "configId",
        created_at as "createdAt"
      from apikey
      where reference_id = ${workspaceId}
        and config_id = ${SYSTEM_MANAGED_API_KEY_CONFIG_ID}
      order by created_at desc
    `
  );

  return result.rows.map((apiKey) => ({
    id: apiKey.id,
    name: apiKey.name ?? null,
    start: apiKey.start ?? null,
    prefix: apiKey.prefix ?? null,
    configId: apiKey.configId,
    createdAt: apiKey.createdAt,
  }));
}

export async function listWorkspacesWithPlan(
  params: WorkspaceListParams
): Promise<WorkspaceListResult> {
  return listAdminWorkspaces({ db: getDb(), params });
}

export async function getWorkspaceDetail(
  workspaceId: string
): Promise<WorkspaceDetail | null> {
  const detail = await getAdminWorkspaceDetail({ db: getDb(), workspaceId });

  if (!detail) {
    return null;
  }

  return {
    ...detail,
    apiKeys: await listWorkspaceApiKeys(workspaceId),
  };
}

export async function upsertEntitlementOverrides(
  input: EntitlementOverrideInput
): Promise<void> {
  await setAdminWorkspaceEntitlementOverrides({
    db: getDb(),
    workspaceId: input.workspaceId,
    limits: input.limits,
    features: input.features,
    quotas: input.quotas,
    notes: input.notes ?? null,
  });
}

export async function deleteEntitlementOverrides(
  workspaceId: string
): Promise<void> {
  await clearAdminWorkspaceEntitlementOverrides({
    db: getDb(),
    workspaceId,
  });
}

export async function createWorkspaceApiKey(
  input: WorkspaceApiKeyCreateInput
): Promise<CreatedWorkspaceApiKey> {
  const workspace = await getAdminWorkspaceDetail({
    db: getDb(),
    workspaceId: input.workspaceId,
  });

  if (!workspace) {
    throw new Error('Workspace not found.');
  }

  if (!workspace.ownerUserId) {
    throw new Error('Workspace owner not found.');
  }

  // Better Auth organization-owned key creation still validates organization
  // membership, so we create the workspace key server-side on behalf of the
  // workspace owner instead of the acting platform admin session.
  const result = await getAuth().api.createApiKey({
    body: {
      userId: workspace.ownerUserId,
      organizationId: input.workspaceId,
      configId: SYSTEM_MANAGED_API_KEY_CONFIG_ID,
      name: input.name,
      prefix: WORKSPACE_API_KEY_PREFIX,
    },
  });

  const data = unwrapBetterAuthResult<CreatedWorkspaceApiKey>(result);
  return {
    id: data.id,
    key: data.key,
    start: data.start ?? null,
    prefix: data.prefix ?? null,
  };
}

export async function deleteWorkspaceApiKey(
  input: WorkspaceApiKeyDeleteInput
): Promise<void> {
  const existing = await getDb().execute<
    Record<string, string> & { id: string }
  >(
    sql`
      select id
      from apikey
      where id = ${input.apiKeyId}
        and reference_id = ${input.workspaceId}
        and config_id = ${SYSTEM_MANAGED_API_KEY_CONFIG_ID}
      limit 1
    `
  );
  const apiKey = existing.rows.at(0);

  if (!apiKey) {
    throw new Error('API key not found.');
  }

  await getDb().execute(
    sql`
      delete from apikey
      where id = ${input.apiKeyId}
        and reference_id = ${input.workspaceId}
        and config_id = ${SYSTEM_MANAGED_API_KEY_CONFIG_ID}
    `
  );
}
