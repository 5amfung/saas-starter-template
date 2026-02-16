import {
  IconUser,
  IconUserCheck,
  IconUserPlus,
  IconUserX,
} from '@tabler/icons-react';
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

interface AdminDashboardCardsProps {
  totalUsers: number;
  verifiedUsers: number;
  unverifiedUsers: number;
  signupsToday: number;
  verifiedToday: number;
  unverifiedToday: number;
}

export function AdminDashboardCards({
  totalUsers,
  verifiedUsers,
  unverifiedUsers,
  signupsToday,
  verifiedToday,
  unverifiedToday,
}: AdminDashboardCardsProps) {
  return (
    <div className="grid grid-cols-1 gap-4 px-4 sm:grid-cols-2 lg:px-6 xl:grid-cols-4">
      <MetricCard
        title="Total Verified Users"
        value={verifiedUsers}
        icon={<IconUser className="text-muted-foreground size-4" />}
        secondary={
          <div className="text-muted-foreground flex gap-3 text-xs">
            <span className="flex items-center gap-1">
              <IconUser className="size-3.5" />
              {totalUsers} total
            </span>
            <span className="flex items-center gap-1">
              <IconUserX className="size-3.5 text-amber-500" />
              {unverifiedUsers} unverified
            </span>
          </div>
        }
      />
      <MetricCard
        title="Signups Today"
        value={signupsToday}
        icon={<IconUserPlus className="text-muted-foreground size-4" />}
        secondary={
          <div className="text-muted-foreground flex gap-3 text-xs">
            <span className="flex items-center gap-1">
              <IconUserCheck className="size-3.5 text-emerald-500" />
              {verifiedToday} verified
            </span>
            <span className="flex items-center gap-1">
              <IconUserX className="size-3.5 text-amber-500" />
              {unverifiedToday} unverified
            </span>
          </div>
        }
      />
    </div>
  );
}

function MetricCard({
  title,
  value,
  valueSuffix,
  icon,
  secondary,
}: {
  title: string;
  value: number;
  valueSuffix?: React.ReactNode;
  icon: React.ReactNode;
  secondary?: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardDescription>{title}</CardDescription>
          {icon}
        </div>
        <CardTitle className="flex items-baseline gap-2 text-2xl font-semibold tabular-nums">
          <span>{value.toLocaleString()}</span>
          {valueSuffix}
        </CardTitle>
        {secondary}
      </CardHeader>
    </Card>
  );
}

export function AdminDashboardCardsSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 px-4 sm:grid-cols-2 lg:px-6 xl:grid-cols-4">
      <MetricCardSkeleton withSecondary />
      <MetricCardSkeleton withSecondary />
    </div>
  );
}

function MetricCardSkeleton({ withSecondary }: { withSecondary?: boolean }) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="size-4 rounded-full" />
        </div>
        <Skeleton className="h-8 w-20" />
        {withSecondary ? (
          <div className="flex gap-3">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-28" />
          </div>
        ) : null}
      </CardHeader>
    </Card>
  );
}
