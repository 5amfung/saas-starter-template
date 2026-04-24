import { Outlet, createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/admin/_protected/users')({
  component: UsersLayout,
  staticData: { title: 'Users', breadcrumbHref: '/admin/users' },
});

function UsersLayout() {
  return <Outlet />;
}
