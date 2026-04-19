import { useQuery } from '@tanstack/react-query';
import {
  getWorkspaceAccessCapabilities,
  getWorkspaceCapabilities,
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

export const WORKSPACE_ACCESS_CAPABILITIES_QUERY_KEY = (
  workspaceId: string | null
) => ['workspace', 'access-capabilities', workspaceId] as const;

export function useWorkspaceAccessCapabilitiesQuery(
  workspaceId: string | null,
  enabled = true
) {
  return useQuery({
    queryKey: WORKSPACE_ACCESS_CAPABILITIES_QUERY_KEY(workspaceId),
    queryFn: () =>
      getWorkspaceAccessCapabilities({
        data: { workspaceId: requireWorkspaceId(workspaceId) },
      }),
    enabled: enabled && isWorkspaceCapabilitiesQueryEnabled(workspaceId),
  });
}
