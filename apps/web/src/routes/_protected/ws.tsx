import { Outlet, createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/_protected/ws')({
  component: WorkspaceLayout,
  staticData: { title: 'Workspace' },
});

function WorkspaceLayout() {
  return <Outlet />;
}
