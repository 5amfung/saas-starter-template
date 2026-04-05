import { useQuery } from '@tanstack/react-query';
import {
  getWorkspaceAccessCapabilities,
  getWorkspaceCapabilities,
} from './workspace-capabilities.functions';

export const WORKSPACE_CAPABILITIES_QUERY_KEY = (workspaceId: string | null) =>
  ['workspace', 'capabilities', workspaceId] as const;

export function useWorkspaceCapabilitiesQuery(
  workspaceId: string | null,
  enabled = true
) {
  return useQuery({
    queryKey: WORKSPACE_CAPABILITIES_QUERY_KEY(workspaceId),
    queryFn: () => {
      if (!workspaceId) {
        throw new Error('Workspace ID is required.');
      }

      return getWorkspaceCapabilities({
        data: { workspaceId },
      });
    },
    enabled: enabled && workspaceId !== null && workspaceId.length > 0,
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
    queryFn: () => {
      if (!workspaceId) {
        throw new Error('Workspace ID is required.');
      }

      return getWorkspaceAccessCapabilities({
        data: { workspaceId },
      });
    },
    enabled: enabled && workspaceId !== null && workspaceId.length > 0,
  });
}
