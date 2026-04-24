import { IconArrowLeft } from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import {
  Link,
  createFileRoute,
  isNotFound,
  notFound,
} from '@tanstack/react-router';
import { Button } from '@workspace/ui/components/button';
import { Separator } from '@workspace/ui/components/separator';
import { useSessionQuery } from '@workspace/components/hooks';
import { getUser } from '@/admin/users.functions';
import { AdminDeleteUserDialog } from '@/components/admin/admin-delete-user-dialog';
import {
  AdminUserForm,
  AdminUserFormSkeleton,
} from '@/components/admin/admin-user-form';
import { useAdminAppCapabilities } from '@/policy/admin-app-capabilities';

export const Route = createFileRoute('/admin/_protected/users/$userId')({
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
      render={<Link to="/admin/users" />}
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
  const sessionQuery = useSessionQuery();
  const { capabilities, isPending: isAdminCapabilitiesPending } =
    useAdminAppCapabilities();
  const canDeleteTargetUser = capabilities.canDeleteUsers;
  const isSelfDelete = sessionQuery.data?.user.id === userId;

  const userQuery = useQuery({
    queryKey: ['admin', 'user', userId],
    enabled: !isAdminCapabilitiesPending && capabilities.canViewUsers,
    queryFn: async () => {
      return getUser({ data: { userId } });
    },
    retry: false,
  });

  if (isAdminCapabilitiesPending) {
    return (
      <div className={PAGE_LAYOUT_CLASS}>
        <div className="self-start">
          <BackToUserListButton disabled />
        </div>
        <AdminUserFormSkeleton />
      </div>
    );
  }

  if (!capabilities.canViewUsers) {
    throw notFound();
  }

  if (userQuery.isError) {
    // Re-throw during render so the router's CatchNotFound boundary shows 404.
    if (isNotFound(userQuery.error)) throw userQuery.error;

    return (
      <div className="flex flex-col items-center gap-2 py-12">
        <p className="text-sm text-destructive">Failed to load user.</p>
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
          <AdminUserForm
            user={userQuery.data}
            canManageUsers={capabilities.canManageUsers}
          />
          {canDeleteTargetUser ? (
            <>
              <Separator />
              <div className="flex flex-col gap-4 rounded-lg border border-dashed border-destructive/30 p-4">
                <div>
                  <h3 className="text-sm font-medium">Danger Zone</h3>
                  <p className="text-sm text-muted-foreground">
                    Permanently delete this user and all associated data.
                  </p>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <AdminDeleteUserDialog
                    userId={userQuery.data.id}
                    userEmail={userQuery.data.email}
                    disabled={isSelfDelete}
                  />
                  {isSelfDelete ? (
                    <p className="text-xs text-muted-foreground">
                      You cannot delete your own account.
                    </p>
                  ) : null}
                </div>
              </div>
            </>
          ) : null}
        </>
      )}
    </div>
  );
}
