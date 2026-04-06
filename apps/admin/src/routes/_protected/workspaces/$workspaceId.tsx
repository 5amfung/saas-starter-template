import { IconArrowLeft } from '@tabler/icons-react';
import {
  Link,
  createFileRoute,
  isNotFound,
  notFound,
} from '@tanstack/react-router';
import { Badge } from '@workspace/ui/components/badge';
import { Button } from '@workspace/ui/components/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@workspace/ui/components/card';
import { Input } from '@workspace/ui/components/input';
import { Label } from '@workspace/ui/components/label';
import { Separator } from '@workspace/ui/components/separator';
import { Skeleton } from '@workspace/ui/components/skeleton';
import { AdminEntitlementOverrideForm } from '@/components/admin/admin-entitlement-override-form';
import { useAdminWorkspaceDetailQuery } from '@/admin/workspaces.queries';
import { getAdminAppCapabilities } from '@/policy/admin-app-capabilities.functions';
import { useAdminAppCapabilities } from '@/policy/admin-app-capabilities';
import { requireAdminRouteCapability } from '@/policy/admin-app-route-access';

export const Route = createFileRoute('/_protected/workspaces/$workspaceId')({
  beforeLoad: async () => {
    const capabilities = await getAdminAppCapabilities();
    requireAdminRouteCapability(capabilities, 'canViewWorkspaces');
  },
  component: AdminWorkspaceDetailPage,
  staticData: { title: 'Workspace Details' },
});

const PAGE_LAYOUT_CLASS =
  'mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-4 md:py-6 lg:px-6';
const TWO_COLUMN_GRID = 'grid grid-cols-1 gap-4 sm:grid-cols-2';
const READ_ONLY_INPUT_CLASS = 'bg-muted text-sm';
const READ_ONLY_MONO_INPUT_CLASS = 'bg-muted font-mono text-sm';

function BackToWorkspaceListButton({ disabled }: { disabled?: boolean }) {
  return (
    <Button
      nativeButton={false}
      variant="ghost"
      size="sm"
      render={<Link to="/workspaces" />}
      disabled={disabled}
      aria-busy={disabled || undefined}
    >
      <IconArrowLeft className="size-4" />
      Back
    </Button>
  );
}

function AdminWorkspaceDetailPage() {
  const { workspaceId } = Route.useParams();
  const { capabilities } = useAdminAppCapabilities();

  const workspaceQuery = useAdminWorkspaceDetailQuery(workspaceId);

  if (workspaceQuery.isError) {
    if (isNotFound(workspaceQuery.error)) throw workspaceQuery.error;

    return (
      <div className="flex flex-col items-center gap-2 py-12">
        <p className="text-sm text-destructive">Failed to load workspace.</p>
        <Button
          variant="outline"
          size="sm"
          onClick={() => workspaceQuery.refetch()}
        >
          Retry
        </Button>
      </div>
    );
  }

  if (workspaceQuery.isPending) {
    return (
      <div className={PAGE_LAYOUT_CLASS}>
        <div className="self-start">
          <BackToWorkspaceListButton disabled />
        </div>
        <WorkspaceDetailSkeleton />
      </div>
    );
  }

  if (!workspaceQuery.data) {
    throw notFound();
  }

  const workspace = workspaceQuery.data;

  return (
    <div className={PAGE_LAYOUT_CLASS}>
      <div className="self-start">
        <BackToWorkspaceListButton />
      </div>
      <>
        {/* Info Section */}
        <Card>
          <CardHeader>
            <CardTitle>Workspace Info</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className={TWO_COLUMN_GRID}>
              <ReadOnlyField label="Name" value={workspace.name} />
              <ReadOnlyField label="Slug" value={workspace.slug} mono />
            </div>
            <div className={TWO_COLUMN_GRID}>
              <ReadOnlyField label="Workspace ID" value={workspace.id} mono />
              <ReadOnlyField
                label="Members"
                value={String(workspace.memberCount)}
              />
            </div>
            <div className={TWO_COLUMN_GRID}>
              <ReadOnlyField
                label="Owner"
                value={workspace.ownerEmail ?? 'No owner'}
              />
              <ReadOnlyField
                label="Created"
                value={new Date(workspace.createdAt).toLocaleString()}
              />
            </div>
          </CardContent>
        </Card>

        {capabilities.canViewWorkspaceBilling ? (
          <Card>
            <CardHeader>
              <CardTitle>Subscription</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className={TWO_COLUMN_GRID}>
                <div className="space-y-2">
                  <Label>Plan</Label>
                  <div>
                    <Badge variant="default" className="capitalize">
                      {workspace.planId}
                    </Badge>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Status</Label>
                  <div>
                    <Badge
                      variant={
                        workspace.subscription?.status === 'active'
                          ? 'outline'
                          : 'secondary'
                      }
                      className="capitalize"
                    >
                      {workspace.subscription?.status ?? 'Free'}
                    </Badge>
                    {workspace.subscription?.cancelAtPeriodEnd ? (
                      <Badge variant="destructive" className="ml-2">
                        Canceling
                      </Badge>
                    ) : null}
                  </div>
                </div>
              </div>
              {workspace.subscription ? (
                <div className={TWO_COLUMN_GRID}>
                  <ReadOnlyField
                    label="Stripe Subscription ID"
                    value={workspace.subscription.stripeSubscriptionId ?? 'N/A'}
                    mono
                  />
                  <ReadOnlyField
                    label="Period End"
                    value={
                      workspace.subscription.periodEnd
                        ? new Date(
                            workspace.subscription.periodEnd
                          ).toLocaleString()
                        : 'N/A'
                    }
                  />
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No active subscription.
                </p>
              )}
            </CardContent>
          </Card>
        ) : null}

        {/* Entitlement Overrides — enterprise only */}
        {workspace.planId === 'enterprise' &&
        capabilities.canManageEntitlementOverrides ? (
          <>
            <Separator />
            <AdminEntitlementOverrideForm
              workspaceId={workspace.id}
              overrides={workspace.overrides}
            />
          </>
        ) : null}
      </>
    </div>
  );
}

// --- Internal components ---

function ReadOnlyField({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Input
        value={value}
        readOnly
        className={mono ? READ_ONLY_MONO_INPUT_CLASS : READ_ONLY_INPUT_CLASS}
      />
    </div>
  );
}

function WorkspaceDetailSkeleton() {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-32" />
        </CardHeader>
        <CardContent className="space-y-4">
          <div className={TWO_COLUMN_GRID}>
            <SkeletonField />
            <SkeletonField />
          </div>
          <div className={TWO_COLUMN_GRID}>
            <SkeletonField />
            <SkeletonField />
          </div>
          <div className={TWO_COLUMN_GRID}>
            <SkeletonField />
            <SkeletonField />
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-28" />
        </CardHeader>
        <CardContent className="space-y-4">
          <div className={TWO_COLUMN_GRID}>
            <SkeletonField />
            <SkeletonField />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function SkeletonField() {
  return (
    <div className="space-y-2">
      <Skeleton className="h-4 w-20" />
      <Skeleton className="h-9 w-full" />
    </div>
  );
}
