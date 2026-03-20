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
import type { ChartConfig } from '@workspace/ui/components/chart';
import { Skeleton } from '@workspace/ui/components/skeleton';
import {
  ToggleGroup,
  ToggleGroupItem,
} from '@workspace/ui/components/toggle-group';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@workspace/ui/components/select';

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

function TimeRangeToggle({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <>
      <ToggleGroup
        multiple={false}
        value={value ? [value] : []}
        onValueChange={(v) => onChange(v[0] ?? '7d')}
        variant="outline"
        className="hidden *:data-[slot=toggle-group-item]:px-4! @[767px]/card:flex"
      >
        <ToggleGroupItem value="90d">Last 3 months</ToggleGroupItem>
        <ToggleGroupItem value="30d">Last 30 days</ToggleGroupItem>
        <ToggleGroupItem value="7d">Last 7 days</ToggleGroupItem>
      </ToggleGroup>
      <Select
        value={value}
        onValueChange={(v) => {
          if (v) onChange(v);
        }}
      >
        <SelectTrigger
          className="flex w-40 **:data-[slot=select-value]:block **:data-[slot=select-value]:truncate @[767px]/card:hidden"
          size="sm"
          aria-label="Select time range"
        >
          <SelectValue placeholder="Last 7 days" />
        </SelectTrigger>
        <SelectContent className="rounded-xl">
          <SelectItem value="90d" className="rounded-lg">
            Last 3 months
          </SelectItem>
          <SelectItem value="30d" className="rounded-lg">
            Last 30 days
          </SelectItem>
          <SelectItem value="7d" className="rounded-lg">
            Last 7 days
          </SelectItem>
        </SelectContent>
      </Select>
    </>
  );
}

function formatDateTick(value: string) {
  const date = new Date(value + 'T00:00:00');
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatDateLabel(value: React.ReactNode) {
  const date = new Date(String(value) + 'T00:00:00');
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}
