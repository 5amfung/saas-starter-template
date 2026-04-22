import { queryOptions, useQuery } from '@tanstack/react-query';
import { authClient } from '@workspace/auth/client';
import {
  getWorkspaceById,
  getWorkspaceSwitcherTriggerDetail,
} from '@/workspace/workspace.functions';

type WorkspaceSummary = {
  id: string;
  name: string;
  slug: string;
  createdAt: Date;
  logo?: string | null;
  metadata?: unknown;
};

export const WORKSPACE_LIST_QUERY_KEY = ['workspace', 'list'] as const;
export const WORKSPACE_DETAIL_QUERY_KEY = (workspaceId: string) =>
  ['workspace', 'detail', workspaceId] as const;
export const WORKSPACE_SWITCHER_TRIGGER_DETAIL_QUERY_KEY = (
  workspaceId: string
) => ['workspace', 'switcher-trigger-detail', workspaceId] as const;

export function workspaceDetailQueryOptions(workspaceId: string) {
  return queryOptions({
    queryKey: WORKSPACE_DETAIL_QUERY_KEY(workspaceId),
    queryFn: async () => {
      return getWorkspaceById({ data: { workspaceId } });
    },
  });
}

export function workspaceSwitcherTriggerDetailQueryOptions(
  workspaceId: string
) {
  return queryOptions({
    queryKey: WORKSPACE_SWITCHER_TRIGGER_DETAIL_QUERY_KEY(workspaceId),
    queryFn: async () => {
      return getWorkspaceSwitcherTriggerDetail({ data: { workspaceId } });
    },
  });
}

export function useWorkspaceListQuery() {
  return useQuery({
    queryKey: WORKSPACE_LIST_QUERY_KEY,
    queryFn: async () => {
      const { data, error } = await authClient.organization.list();
      if (error) throw new Error(error.message);
      return data as Array<WorkspaceSummary>;
    },
  });
}

export function useWorkspaceDetailQuery(workspaceId: string | null) {
  return useQuery({
    ...workspaceDetailQueryOptions(workspaceId ?? ''),
    enabled: workspaceId !== null,
  });
}

export function useWorkspaceSwitcherTriggerDetailQuery(
  workspaceId: string | null
) {
  return useQuery({
    ...workspaceSwitcherTriggerDetailQueryOptions(workspaceId ?? ''),
    enabled: workspaceId !== null,
  });
}
