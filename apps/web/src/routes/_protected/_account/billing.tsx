import { Link, createFileRoute } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { IconLoader2 } from '@tabler/icons-react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@workspace/ui/components/card';
import { Badge } from '@workspace/ui/components/badge';
import { getBillingSummary } from '@/billing/billing.functions';

export const Route = createFileRoute('/_protected/_account/billing')({
  component: BillingOverviewPage,
  staticData: { title: 'Billing' },
});

const PAGE_LAYOUT_CLASS =
  'mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-4 md:py-6 lg:px-6';

function formatRenewalDate(isoDate: string | null): string | null {
  if (!isoDate) return null;
  return new Date(isoDate).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

function StatusBadge({ status }: { status: string | null }) {
  if (!status) return <Badge variant="secondary">Free</Badge>;
  if (status === 'active') return <Badge variant="default">Active</Badge>;
  if (status === 'trialing') return <Badge variant="secondary">Trial</Badge>;
  if (status === 'past_due')
    return <Badge variant="destructive">Past due</Badge>;
  return <Badge variant="outline">{status}</Badge>;
}

function BillingOverviewPage() {
  const summaryQuery = useQuery({
    queryKey: ['billing', 'summary'],
    queryFn: () => getBillingSummary(),
  });

  const isLoading = summaryQuery.isPending;
  const summaries = summaryQuery.data ?? [];

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
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <IconLoader2 className="size-5 animate-spin text-muted-foreground" />
            </div>
          ) : summaries.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              You don't own any workspaces yet.
            </p>
          ) : (
            <div className="flex flex-col gap-3">
              {summaries.map((ws) => (
                <Link
                  key={ws.workspaceId}
                  to="/ws/$workspaceId/billing"
                  params={{ workspaceId: ws.workspaceId }}
                  className="flex items-center justify-between rounded-lg border p-4 transition-colors hover:bg-muted/50"
                >
                  <div className="flex flex-col gap-1">
                    <p className="font-medium">{ws.workspaceName}</p>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <span>{ws.planName} plan</span>
                      <StatusBadge status={ws.status} />
                      {ws.periodEnd ? (
                        <span>Renews {formatRenewalDate(ws.periodEnd)}</span>
                      ) : null}
                    </div>
                  </div>
                  <span className="text-sm text-muted-foreground">
                    Manage &rarr;
                  </span>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
