import * as React from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@workspace/ui/components/button';
import {
  AdminDashboardCards,
  AdminDashboardCardsSkeleton,
} from '@/components/admin/admin-dashboard-cards';
import {
  AdminSignupChart,
  AdminSignupChartSkeleton,
} from '@/components/admin/admin-signup-chart';
import {
  AdminMauChart,
  AdminMauChartSkeleton,
} from '@/components/admin/admin-mau-chart';
import {
  getAdminDashboardMetrics,
  getMauChartData,
  getSignupChartData,
} from '@/admin/admin.functions';

export const Route = createFileRoute('/_protected/admin/dashboard')({
  component: AdminDashboardPage,
  staticData: { title: 'Dashboard' },
});

const TIME_RANGE_DAYS: Record<string, number> = {
  '7d': 7,
  '30d': 30,
  '90d': 90,
};

function AdminDashboardPage() {
  const timezoneOffset = React.useMemo(
    () => new Date().getTimezoneOffset(),
    []
  );
  const [signupRange, setSignupRange] = React.useState('7d');
  const [mauRange, setMauRange] = React.useState('7d');

  const metricsQuery = useQuery({
    queryKey: ['admin', 'dashboard-metrics', timezoneOffset],
    queryFn: () => getAdminDashboardMetrics({ data: { timezoneOffset } }),
  });

  const signupChartQuery = useQuery({
    queryKey: ['admin', 'signup-chart', signupRange, timezoneOffset],
    queryFn: () =>
      getSignupChartData({
        data: { days: TIME_RANGE_DAYS[signupRange], timezoneOffset },
      }),
  });

  const mauChartQuery = useQuery({
    queryKey: ['admin', 'mau-chart', mauRange, timezoneOffset],
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
