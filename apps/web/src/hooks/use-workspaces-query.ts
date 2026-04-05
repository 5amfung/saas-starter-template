import {
  WORKSPACE_LIST_QUERY_KEY,
  useWorkspaceListQuery,
} from '@/workspace/workspace.queries';
export {
  addWorkspaceToList,
  renameWorkspaceInList,
} from '@/workspace/workspace.mutations';

export const WORKSPACES_QUERY_KEY = WORKSPACE_LIST_QUERY_KEY;

export const useWorkspacesQuery = useWorkspaceListQuery;
