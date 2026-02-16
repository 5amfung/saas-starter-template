import {
  Link,
  createFileRoute,
  isNotFound,
  notFound,
} from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { IconArrowLeft } from '@tabler/icons-react';
import {
  AdminUserForm,
  AdminUserFormSkeleton,
} from '@/components/admin/admin-user-form';
import { AdminDeleteUserDialog } from '@/components/admin/admin-delete-user-dialog';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { authClient } from '@/auth/auth-client';

export const Route = createFileRoute('/_protected/admin/user/$userId')({
  component: AdminUserDetailPage,
  staticData: { title: 'User Details' },
});

const PAGE_LAYOUT_CLASS =
  'mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-4 md:py-6 lg:px-6';

function BackToUserListButton({ disabled }: { disabled?: boolean }) {
  return (
    <Button
      nativeButton={false}
      variant="ghost"
      size="sm"
      render={<Link to="/admin/user" />}
      disabled={disabled}
      aria-busy={disabled || undefined}
    >
      <IconArrowLeft className="size-4" />
      Back
    </Button>
  );
}

function AdminUserDetailPage() {
  const { userId } = Route.useParams();

  const userQuery = useQuery({
    queryKey: ['admin', 'user', userId],
    queryFn: async () => {
      const { data, error } = await authClient.admin.listUsers({
        query: {
          filterField: 'id',
          filterValue: userId,
          filterOperator: 'eq',
          limit: 1,
        },
      });

      // Network / API errors — let TanStack Query surface them so the retry
      // button is shown instead of a misleading 404 page.
      if (error) throw error;

      // No matching user — surface as 404.
      const user = data.users.at(0);
      if (!user) throw notFound();

      return user;
    },
    retry: false,
  });

  if (userQuery.isError) {
    // Re-throw during render so the router's CatchNotFound boundary shows 404.
    if (isNotFound(userQuery.error)) throw userQuery.error;

    return (
      <div className="flex flex-col items-center gap-2 py-12">
        <p className="text-destructive text-sm">Failed to load user.</p>
        <Button variant="outline" size="sm" onClick={() => userQuery.refetch()}>
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className={PAGE_LAYOUT_CLASS}>
      <div className="self-start">
        <BackToUserListButton disabled={userQuery.isPending} />
      </div>
      {userQuery.isPending ? (
        <AdminUserFormSkeleton />
      ) : (
        <>
          <AdminUserForm user={userQuery.data} />
          <Separator />
          <div className="flex flex-col gap-4 rounded-lg border border-dashed border-destructive/30 p-4">
            <div>
              <h3 className="text-sm font-medium">Danger Zone</h3>
              <p className="text-muted-foreground text-sm">
                Permanently delete this user and all associated data.
              </p>
            </div>
            <div className="flex justify-end">
              <AdminDeleteUserDialog
                userId={userQuery.data.id}
                userEmail={userQuery.data.email}
              />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
