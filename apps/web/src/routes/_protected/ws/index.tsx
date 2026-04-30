import { createFileRoute, redirect } from '@tanstack/react-router';
import { APIError } from 'better-auth/api';
import { getWorkspaceIndexRouteTarget } from '@/workspace/workspace.functions';

export const Route = createFileRoute('/_protected/ws/')({
  component: WorkspaceIndexPage,
  loader: async () => {
    const target = await getWorkspaceIndexRouteTarget();

    if (target.kind === 'redirect') {
      throw redirect({ to: target.to });
    }

    if (target.kind === 'blocked') {
      throw new APIError('FORBIDDEN', {
        message: 'No accessible workspaces found for this user.',
      });
    }

    throw redirect({
      to: '/ws/$workspaceId/overview',
      params: { workspaceId: target.workspaceId },
      replace: true,
    });
  },
});

function WorkspaceIndexPage() {
  return null;
}
