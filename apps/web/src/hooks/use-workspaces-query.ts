import { useQuery } from '@tanstack/react-query';
import { authClient } from '@workspace/auth/client';

type WorkspaceSummary = {
  id: string;
  name: string;
  slug: string;
  createdAt: Date;
  logo?: string | null;
  metadata?: unknown;
};

export const WORKSPACES_QUERY_KEY = ['workspace', 'list'] as const;

export function renameWorkspaceInList(
  workspaces: Array<WorkspaceSummary> | undefined,
  workspaceId: string,
  nextName: string
) {
  if (!workspaces) return workspaces;

  return workspaces.map((workspace) =>
    workspace.id === workspaceId
      ? {
          ...workspace,
          name: nextName,
        }
      : workspace
  );
}

export function useWorkspacesQuery() {
  return useQuery({
    queryKey: WORKSPACES_QUERY_KEY,
    queryFn: async () => {
      const { data, error } = await authClient.organization.list();
      if (error) throw new Error(error.message);
      return data as Array<WorkspaceSummary>;
    },
  });
}
