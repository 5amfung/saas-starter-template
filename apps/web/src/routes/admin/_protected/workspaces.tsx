import { Outlet, createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/admin/_protected/workspaces')({
  component: WorkspacesLayout,
  staticData: { title: 'Workspaces', breadcrumbHref: '/admin/workspaces' },
});

function WorkspacesLayout() {
  return <Outlet />;
}
