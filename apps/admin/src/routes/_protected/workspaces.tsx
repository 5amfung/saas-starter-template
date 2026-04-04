import { Outlet, createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/_protected/workspaces')({
  component: WorkspacesLayout,
  staticData: { title: 'Workspaces', breadcrumbHref: '/workspaces' },
});

function WorkspacesLayout() {
  return <Outlet />;
}
