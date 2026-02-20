import { useEffect } from 'react';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { getActiveWorkspace } from '@/workspace/workspace.functions';

export const Route = createFileRoute('/_protected/ws')({
  component: WorkspaceEntryPage,
  loader: async () => {
    return getActiveWorkspace();
  },
  staticData: { title: 'Workspace' },
});

function WorkspaceEntryPage() {
  const navigate = useNavigate();
  const activeWorkspace = Route.useLoaderData();

  useEffect(() => {
    navigate({
      to: '/ws/$workspaceId/dashboard',
      params: { workspaceId: activeWorkspace.id },
      replace: true,
    });
  }, [activeWorkspace.id, navigate]);

  return null;
}
