import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/_protected/admin/user')({
  component: AdminUserPage,
  staticData: { title: 'User' },
});

function AdminUserPage() {
  return (
    <div className="flex flex-1 items-center justify-center py-12">
      <div className="text-center">
        <h2 className="text-lg font-medium">User Management</h2>
        <p className="text-muted-foreground text-sm">Coming soon.</p>
      </div>
    </div>
  );
}
