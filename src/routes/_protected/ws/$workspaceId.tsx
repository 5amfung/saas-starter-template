import { Outlet, createFileRoute } from '@tanstack/react-router';
import { ensureWorkspaceRouteAccess } from '@/workspace/workspace.functions';

export const Route = createFileRoute('/_protected/ws/$workspaceId')({
  component: WorkspaceLayout,
  beforeLoad: async ({ params }) => {
    await ensureWorkspaceRouteAccess({ data: { workspaceId: params.workspaceId } });
  },
});

function WorkspaceLayout() {
  return <Outlet />;
}
