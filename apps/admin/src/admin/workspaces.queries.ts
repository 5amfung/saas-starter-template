import {
  keepPreviousData,
  queryOptions,
  useQuery,
} from '@tanstack/react-query';
import { getWorkspace, listWorkspaces } from '@/admin/workspaces.functions';

type FilterTab = 'all' | 'self-serve' | 'enterprise';

type AdminWorkspaceListQueryInput = {
  page: number;
  pageSize: number;
  search: string;
  filter: FilterTab;
  sortBy?: string;
  sortDirection?: 'asc' | 'desc';
};

export function adminWorkspaceListQueryKey({
  page,
  pageSize,
  search,
  filter,
  sortBy,
  sortDirection,
}: AdminWorkspaceListQueryInput) {
  return [
    'admin',
    'workspaces',
    page,
    pageSize,
    search,
    filter,
    sortBy,
    sortDirection,
  ] as const;
}

export const ADMIN_WORKSPACE_DETAIL_QUERY_KEY = (workspaceId: string) =>
  ['admin', 'workspace', workspaceId] as const;

export function adminWorkspaceListQueryOptions({
  page,
  pageSize,
  search,
  filter,
  sortBy,
  sortDirection,
}: AdminWorkspaceListQueryInput) {
  return queryOptions({
    queryKey: adminWorkspaceListQueryKey({
      page,
      pageSize,
      search,
      filter,
      sortBy,
      sortDirection,
    }),
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const result = await listWorkspaces({
        data: {
          limit: pageSize,
          offset: (page - 1) * pageSize,
          ...(search ? { search } : {}),
          ...(filter !== 'all' ? { filter } : {}),
          ...(sortBy ? { sortBy, sortDirection: sortDirection ?? 'asc' } : {}),
        },
      });

      return {
        workspaces: result.workspaces,
        total: result.total,
        page,
        pageSize,
        totalPages: Math.ceil(result.total / pageSize),
      };
    },
  });
}

export function adminWorkspaceDetailQueryOptions(workspaceId: string) {
  return queryOptions({
    queryKey: ADMIN_WORKSPACE_DETAIL_QUERY_KEY(workspaceId),
    queryFn: async () => getWorkspace({ data: { workspaceId } }),
    retry: false,
  });
}

export function useAdminWorkspaceListQuery(
  input: AdminWorkspaceListQueryInput
) {
  return useQuery(adminWorkspaceListQueryOptions(input));
}

export function useAdminWorkspaceDetailQuery(workspaceId: string) {
  return useQuery(adminWorkspaceDetailQueryOptions(workspaceId));
}
