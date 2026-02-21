import { Outlet, createFileRoute } from '@tanstack/react-router';
import { getWorkspaceById } from '@/workspace/workspace.functions';

export const Route = createFileRoute('/_protected/ws/$workspaceId')({
  component: WorkspaceLayout,
  loader: async ({ params }) => {
    return getWorkspaceById({ data: { workspaceId: params.workspaceId } });
  },
});

function WorkspaceLayout() {
  return <Outlet />;
}
