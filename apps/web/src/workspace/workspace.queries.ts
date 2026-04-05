import { queryOptions, useQuery } from '@tanstack/react-query';
import { authClient } from '@workspace/auth/client';
import { getWorkspaceById } from '@/workspace/workspace.functions';

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

export function workspaceDetailQueryOptions(workspaceId: string) {
  return queryOptions({
    queryKey: WORKSPACE_DETAIL_QUERY_KEY(workspaceId),
    queryFn: async () => getWorkspaceById({ data: { workspaceId } }),
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

export function useWorkspaceDetailQuery(workspaceId: string) {
  return useQuery(workspaceDetailQueryOptions(workspaceId));
}
