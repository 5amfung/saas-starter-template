import { useQuery } from '@tanstack/react-query';
import {
  getWorkspaceCapabilities,
  getWorkspaceRoleOnlyCapabilities,
} from './workspace-capabilities.functions';

export const WORKSPACE_CAPABILITIES_QUERY_KEY = (workspaceId: string | null) =>
  ['workspace', 'capabilities', workspaceId] as const;

function isWorkspaceCapabilitiesQueryEnabled(workspaceId: string | null) {
  return workspaceId !== null && workspaceId.length > 0;
}

function requireWorkspaceId(workspaceId: string | null): string {
  if (!workspaceId) {
    throw new Error('Workspace ID is required.');
  }

  return workspaceId;
}

export function useWorkspaceCapabilitiesQuery(
  workspaceId: string | null,
  enabled = true
) {
  return useQuery({
    queryKey: WORKSPACE_CAPABILITIES_QUERY_KEY(workspaceId),
    queryFn: () =>
      getWorkspaceCapabilities({
        data: { workspaceId: requireWorkspaceId(workspaceId) },
      }),
    enabled: enabled && isWorkspaceCapabilitiesQueryEnabled(workspaceId),
  });
}

export const WORKSPACE_ROLE_ONLY_CAPABILITIES_QUERY_KEY = (
  workspaceId: string | null
) => ['workspace', 'role-only-capabilities', workspaceId] as const;

export function useWorkspaceRoleOnlyCapabilitiesQuery(
  workspaceId: string | null,
  enabled = true
) {
  return useQuery({
    queryKey: WORKSPACE_ROLE_ONLY_CAPABILITIES_QUERY_KEY(workspaceId),
    queryFn: () =>
      getWorkspaceRoleOnlyCapabilities({
        data: { workspaceId: requireWorkspaceId(workspaceId) },
      }),
    enabled: enabled && isWorkspaceCapabilitiesQueryEnabled(workspaceId),
  });
}
