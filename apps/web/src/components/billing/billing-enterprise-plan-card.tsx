import { IconCheck } from '@tabler/icons-react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@workspace/ui/components/card';
import type { Plan } from '@workspace/auth/plans';

const DATE_FORMAT = new Intl.DateTimeFormat('en-US', {
  month: 'long',
  day: 'numeric',
  year: 'numeric',
});

interface BillingEnterprisePlanCardProps {
  currentPlan: Plan;
  /** Next billing date. null if no active subscription. */
  nextBillingDate: Date | null;
  /** Current number of members in the workspace. */
  memberCount: number;
}

export function BillingEnterprisePlanCard({
  currentPlan,
  nextBillingDate,
  memberCount,
}: BillingEnterprisePlanCardProps) {
  const memberLimit = currentPlan.limits.maxMembers;
  const memberDisplay =
    memberLimit === -1
      ? `${memberCount} members (unlimited)`
      : `${memberCount} / ${memberLimit} members`;

  return (
    <Card>
      <CardHeader>
        <CardDescription>Current plan</CardDescription>
        <CardTitle className="text-2xl">{currentPlan.name}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <p className="text-sm font-medium">{memberDisplay}</p>
        {nextBillingDate && (
          <p className="text-sm text-muted-foreground">
            Renews on {DATE_FORMAT.format(nextBillingDate)}
          </p>
        )}
        <ul className="mt-1 flex flex-col gap-2">
          {currentPlan.features.map((feature) => (
            <li key={feature} className="flex items-center gap-2 text-sm">
              <IconCheck className="size-3.5 shrink-0 text-muted-foreground" />
              {feature}
            </li>
          ))}
        </ul>
        <p className="mt-2 text-sm text-muted-foreground">
          Contact your account manager to modify your plan.
        </p>
      </CardContent>
    </Card>
  );
}
