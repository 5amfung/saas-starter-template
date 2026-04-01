import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@workspace/ui/components/card';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@workspace/ui/components/chart';
import { Skeleton } from '@workspace/ui/components/skeleton';
import type { ChartConfig } from '@workspace/ui/components/chart';
import {
  TimeRangeToggle,
  formatDateLabel,
  formatDateTick,
} from '@/components/admin/chart-utils';

const chartConfig = {
  mau: {
    label: 'Monthly Active Users',
    color: 'var(--color-chart-1)',
  },
} satisfies ChartConfig;

interface MauChartData {
  date: string;
  mau: number;
}

interface AdminMauChartProps {
  data: Array<MauChartData>;
  timeRange: string;
  onTimeRangeChange: (range: string) => void;
}

export function AdminMauChart({
  data,
  timeRange,
  onTimeRangeChange,
}: AdminMauChartProps) {
  const isEmpty = data.every((d) => d.mau === 0);
  const chartData = isEmpty ? [] : data;

  return (
    <Card className="@container/card">
      <CardHeader>
        <CardTitle>Monthly Active Users</CardTitle>
        <CardDescription>
          Users with a sign-in in the past 30 days
        </CardDescription>
        <CardAction>
          <TimeRangeToggle value={timeRange} onChange={onTimeRangeChange} />
        </CardAction>
      </CardHeader>
      <CardContent className="px-2 pt-4 sm:px-6 sm:pt-6">
        <ChartContainer
          config={chartConfig}
          className="aspect-auto h-[250px] w-full"
        >
          <AreaChart data={chartData}>
            <defs>
              <linearGradient id="fillMau" x1="0" y1="0" x2="0" y2="1">
                <stop
                  offset="5%"
                  stopColor="var(--color-mau)"
                  stopOpacity={0.8}
                />
                <stop
                  offset="95%"
                  stopColor="var(--color-mau)"
                  stopOpacity={0.1}
                />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="date"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              minTickGap={32}
              tickFormatter={formatDateTick}
            />
            <YAxis tickLine={false} axisLine={false} allowDecimals={false} />
            <ChartTooltip
              cursor={false}
              content={
                <ChartTooltipContent
                  labelFormatter={formatDateLabel}
                  indicator="dot"
                />
              }
            />
            <Area
              dataKey="mau"
              type="monotone"
              fill="url(#fillMau)"
              stroke="var(--color-mau)"
            />
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}

export function AdminMauChartSkeleton() {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-4 w-56" />
      </CardHeader>
      <CardContent>
        <Skeleton className="h-[250px] w-full" />
      </CardContent>
    </Card>
  );
}
