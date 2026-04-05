import { Outlet, createFileRoute, notFound } from '@tanstack/react-router';
import { getWorkspaceRouteAccess } from '@/workspace/workspace.functions';
import { workspaceDetailQueryOptions } from '@/workspace/workspace.queries';

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
  staleTime: 30_000,
  loader: async ({ context, params }) => {
    try {
      await context.queryClient.ensureQueryData(
        workspaceDetailQueryOptions(params.workspaceId)
      );

      return await getWorkspaceRouteAccess({
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
