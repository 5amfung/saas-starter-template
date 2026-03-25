import { Link, createFileRoute } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import {
  IconCalendarDue,
  IconChevronRight,
  IconLoader2,
} from '@tabler/icons-react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@workspace/ui/components/card';
import { cn } from '@workspace/ui/lib/utils';
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
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

const STATUS_STYLES: Record<string, string> = {
  active:
    'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400',
  trialing: 'bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400',
  past_due: 'bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-400',
};

const FREE_STYLE = 'bg-muted text-muted-foreground';

function StatusPill({ status }: { status: string | null }) {
  const label = status ?? 'free';
  const style = status ? (STATUS_STYLES[status] ?? FREE_STYLE) : FREE_STYLE;

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize',
        style
      )}
    >
      {label === 'past_due' ? 'Past due' : label}
    </span>
  );
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
            <div className="flex flex-col gap-2">
              {summaries.map((ws) => (
                <Link
                  key={ws.workspaceId}
                  to="/ws/$workspaceId/billing"
                  params={{ workspaceId: ws.workspaceId }}
                  className="group flex items-center gap-4 rounded-lg border p-4 transition-colors hover:bg-muted/50"
                >
                  {/* Left: workspace info */}
                  <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                    <div className="flex items-center gap-2.5">
                      <span className="truncate text-sm font-semibold">
                        {ws.workspaceName}
                      </span>
                      <StatusPill status={ws.status} />
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span>{ws.planName} plan</span>
                      {ws.periodEnd ? (
                        <>
                          <span className="text-border">&middot;</span>
                          <span className="inline-flex items-center gap-1">
                            <IconCalendarDue className="size-3" />
                            Renews {formatRenewalDate(ws.periodEnd)}
                          </span>
                        </>
                      ) : null}
                    </div>
                  </div>

                  {/* Right: manage arrow */}
                  <IconChevronRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
