import { Outlet, createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/_protected/admin')({
  component: AdminLayout,
  staticData: { title: 'Admin', breadcrumbHref: '/admin/dashboard' },
});

function AdminLayout() {
  return <Outlet />;
}
