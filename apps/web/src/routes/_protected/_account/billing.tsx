import { Link, createFileRoute } from '@tanstack/react-router';
import { authClient } from '@workspace/auth/client';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@workspace/ui/components/card';

export const Route = createFileRoute('/_protected/_account/billing')({
  component: BillingOverviewPage,
  staticData: { title: 'Billing' },
});

const PAGE_LAYOUT_CLASS =
  'mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-4 md:py-6 lg:px-6';

function BillingOverviewPage() {
  const { data: organizations } = authClient.useListOrganizations();

  return (
    <div className={PAGE_LAYOUT_CLASS}>
      <Card>
        <CardHeader>
          <CardTitle>Billing Overview</CardTitle>
          <CardDescription>
            Manage billing for each of your workspaces.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-3">
            {organizations?.map((org) => (
              <Link
                key={org.id}
                to="/ws/$workspaceId/billing"
                params={{ workspaceId: org.id }}
                className="flex items-center justify-between rounded-lg border p-4 transition-colors hover:bg-muted/50"
              >
                <div>
                  <p className="font-medium">{org.name}</p>
                </div>
                <span className="text-sm text-muted-foreground">
                  Manage &rarr;
                </span>
              </Link>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
