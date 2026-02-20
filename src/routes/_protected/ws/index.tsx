import { createFileRoute, redirect } from '@tanstack/react-router';
import { getActiveWorkspace } from '@/workspace/workspace.functions';

export const Route = createFileRoute('/_protected/ws/')({
  component: WorkspaceIndexPage,
  loader: async () => {
    const activeWorkspace = await getActiveWorkspace();
    throw redirect({
      to: '/ws/$workspaceId/dashboard',
      params: { workspaceId: activeWorkspace.id },
      replace: true,
    });
  },
});

function WorkspaceIndexPage() {
  return null;
}
