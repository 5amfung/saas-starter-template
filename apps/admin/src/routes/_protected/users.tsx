import { Outlet, createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/_protected/users')({
  component: UsersLayout,
  staticData: { title: 'Users', breadcrumbHref: '/users' },
});

function UsersLayout() {
  return <Outlet />;
}
