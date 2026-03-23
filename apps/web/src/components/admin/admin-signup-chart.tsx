import { Area, AreaChart, CartesianGrid, Legend, XAxis, YAxis } from 'recharts';
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
  verified: {
    label: 'Verified',
    color: 'var(--color-chart-1)',
  },
  unverified: {
    label: 'Unverified',
    color: 'var(--color-chart-2)',
  },
} satisfies ChartConfig;

interface SignupChartData {
  date: string;
  verified: number;
  unverified: number;
}

interface AdminSignupChartProps {
  data: Array<SignupChartData>;
  timeRange: string;
  onTimeRangeChange: (range: string) => void;
}

export function AdminSignupChart({
  data,
  timeRange,
  onTimeRangeChange,
}: AdminSignupChartProps) {
  return (
    <Card className="@container/card">
      <CardHeader>
        <CardTitle>Signups</CardTitle>
        <CardDescription>Daily signups by verification status</CardDescription>
        <CardAction>
          <TimeRangeToggle value={timeRange} onChange={onTimeRangeChange} />
        </CardAction>
      </CardHeader>
      <CardContent className="px-2 pt-4 sm:px-6 sm:pt-6">
        <ChartContainer
          config={chartConfig}
          className="aspect-auto h-[250px] w-full"
        >
          <AreaChart data={data}>
            <defs>
              <linearGradient id="fillVerified" x1="0" y1="0" x2="0" y2="1">
                <stop
                  offset="5%"
                  stopColor="var(--color-verified)"
                  stopOpacity={0.8}
                />
                <stop
                  offset="95%"
                  stopColor="var(--color-verified)"
                  stopOpacity={0.1}
                />
              </linearGradient>
              <linearGradient id="fillUnverified" x1="0" y1="0" x2="0" y2="1">
                <stop
                  offset="5%"
                  stopColor="var(--color-unverified)"
                  stopOpacity={0.8}
                />
                <stop
                  offset="95%"
                  stopColor="var(--color-unverified)"
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
            <Legend />
            <Area
              dataKey="verified"
              type="monotone"
              stackId="signups"
              fill="url(#fillVerified)"
              stroke="var(--color-verified)"
            />
            <Area
              dataKey="unverified"
              type="monotone"
              stackId="signups"
              fill="url(#fillUnverified)"
              stroke="var(--color-unverified)"
            />
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}

export function AdminSignupChartSkeleton() {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-5 w-20" />
        <Skeleton className="h-4 w-48" />
      </CardHeader>
      <CardContent>
        <Skeleton className="h-[250px] w-full" />
      </CardContent>
    </Card>
  );
}
