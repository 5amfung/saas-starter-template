import { Outlet, createFileRoute, notFound } from '@tanstack/react-router';
import { getWorkspaceById } from '@/workspace/workspace.functions';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const isWorkspaceNotFoundError = (error: unknown): boolean => {
  if (!isRecord(error)) return false;
  if (error.code === 'NOT_FOUND') return true;
  if (error.status === 404) return true;
  if (
    isRecord(error.body) &&
    error.body.code === 'NOT_FOUND' &&
    error.body.message === 'Workspace not found.'
  ) {
    return true;
  }
  return error.message === 'Workspace not found.';
};

export const Route = createFileRoute('/_protected/ws/$workspaceId')({
  component: WorkspaceLayout,
  loader: async ({ params }) => {
    try {
      return await getWorkspaceById({
        data: { workspaceId: params.workspaceId },
      });
    } catch (error) {
      if (isWorkspaceNotFoundError(error)) {
        throw notFound({ routeId: '__root__' });
      }
      throw error;
    }
  },
});

function WorkspaceLayout() {
  return <Outlet />;
}
