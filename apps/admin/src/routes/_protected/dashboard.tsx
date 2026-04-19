import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { Button } from '@workspace/ui/components/button';
import {
  getAdminDashboardMetrics,
  getMauChartData,
  getSignupChartData,
} from '@/admin/admin.functions';
import {
  AdminDashboardCards,
  AdminDashboardCardsSkeleton,
} from '@/components/admin/admin-dashboard-cards';
import {
  AdminMauChart,
  AdminMauChartSkeleton,
} from '@/components/admin/admin-mau-chart';
import {
  AdminSignupChart,
  AdminSignupChartSkeleton,
} from '@/components/admin/admin-signup-chart';
import { useAdminAppCapabilities } from '@/policy/admin-app-capabilities';

export const Route = createFileRoute('/_protected/dashboard')({
  component: AdminDashboardPage,
  staticData: { title: 'Dashboard' },
});

const TIME_RANGE_DAYS: Record<string, number> = {
  '7d': 7,
  '30d': 30,
  '90d': 90,
};

function AdminDashboardPage() {
  const { capabilities } = useAdminAppCapabilities();
  const timezoneOffset = React.useMemo(
    () => new Date().getTimezoneOffset(),
    []
  );
  const [signupRange, setSignupRange] = React.useState('7d');
  const [mauRange, setMauRange] = React.useState('7d');

  const metricsQuery = useQuery({
    queryKey: ['admin', 'dashboard-metrics', timezoneOffset],
    enabled: capabilities.canViewDashboard,
    queryFn: () => getAdminDashboardMetrics({ data: { timezoneOffset } }),
  });

  const signupChartQuery = useQuery({
    queryKey: ['admin', 'signup-chart', signupRange, timezoneOffset],
    enabled: capabilities.canViewAnalytics,
    queryFn: () =>
      getSignupChartData({
        data: { days: TIME_RANGE_DAYS[signupRange], timezoneOffset },
      }),
  });

  const mauChartQuery = useQuery({
    queryKey: ['admin', 'mau-chart', mauRange, timezoneOffset],
    enabled: capabilities.canViewAnalytics,
    queryFn: () =>
      getMauChartData({
        data: { days: TIME_RANGE_DAYS[mauRange], timezoneOffset },
      }),
  });

  return (
    <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
      {/* Metric cards. */}
      {metricsQuery.isPending ? (
        <AdminDashboardCardsSkeleton />
      ) : metricsQuery.isError ? (
        <InlineError
          message="Failed to load metrics."
          onRetry={() => metricsQuery.refetch()}
        />
      ) : (
        <AdminDashboardCards {...metricsQuery.data} />
      )}

      {/* Charts. */}
      {capabilities.canViewAnalytics ? (
        <div className="grid grid-cols-1 gap-4 px-4 lg:px-6 xl:grid-cols-2">
          {signupChartQuery.isPending ? (
            <AdminSignupChartSkeleton />
          ) : signupChartQuery.isError ? (
            <InlineError
              message="Failed to load signup chart."
              onRetry={() => signupChartQuery.refetch()}
            />
          ) : (
            <AdminSignupChart
              data={signupChartQuery.data}
              timeRange={signupRange}
              onTimeRangeChange={setSignupRange}
            />
          )}

          {mauChartQuery.isPending ? (
            <AdminMauChartSkeleton />
          ) : mauChartQuery.isError ? (
            <InlineError
              message="Failed to load MAU chart."
              onRetry={() => mauChartQuery.refetch()}
            />
          ) : (
            <AdminMauChart
              data={mauChartQuery.data}
              timeRange={mauRange}
              onTimeRangeChange={setMauRange}
            />
          )}
        </div>
      ) : (
        <div className="px-4 lg:px-6">
          <div className="rounded-lg border border-dashed p-8 text-sm text-muted-foreground">
            Your admin role can view dashboard summaries, but not analytics
            reports.
          </div>
        </div>
      )}
    </div>
  );
}

function InlineError({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed p-8">
      <p className="text-sm text-destructive">{message}</p>
      <Button variant="outline" size="sm" onClick={onRetry}>
        Retry
      </Button>
    </div>
  );
}
