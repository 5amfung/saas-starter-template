import { IconCheck } from '@tabler/icons-react';
import { describeEntitlements, formatPlanPrice } from '@workspace/billing';
import { Button, buttonVariants } from '@workspace/ui/components/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@workspace/ui/components/card';
import type { Entitlements, PlanDefinition } from '@workspace/billing';

interface BillingPlanCardsProps {
  currentPlan: PlanDefinition;
  currentEntitlements: Entitlements;
  /** Next billing date for paid plans. null for free tier. */
  nextBillingDate: Date | null;
  onManagePlan: () => void;
  onBillingPortal: () => void;
  isBillingPortalLoading: boolean;
  /** Workspace name for enterprise mailto link subject. */
  workspaceName: string;
}

const DATE_FORMAT = new Intl.DateTimeFormat('en-US', {
  month: 'long',
  day: 'numeric',
  year: 'numeric',
});

export function BillingPlanCards({
  currentPlan,
  currentEntitlements,
  nextBillingDate,
  onManagePlan,
  onBillingPortal,
  isBillingPortalLoading,
  workspaceName,
}: BillingPlanCardsProps) {
  const shouldShowBillingPortal =
    currentPlan.pricing !== null && !currentPlan.isEnterprise;

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardDescription>Current plan</CardDescription>
          <CardTitle className="text-2xl">{currentPlan.name}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <p className="text-sm text-muted-foreground">
            {currentPlan.isEnterprise
              ? 'Custom pricing'
              : !currentPlan.pricing
                ? 'Free forever'
                : formatPlanPrice(currentPlan, false)}
          </p>
          {nextBillingDate && (
            <p className="text-sm text-muted-foreground">
              Renews on {DATE_FORMAT.format(nextBillingDate)}
            </p>
          )}
          <ul className="mt-1 flex flex-col gap-2">
            {describeEntitlements(currentEntitlements).map((feature) => (
              <li key={feature} className="flex items-center gap-2 text-sm">
                <IconCheck className="size-3.5 shrink-0 text-muted-foreground" />
                {feature}
              </li>
            ))}
          </ul>
        </CardContent>
        {currentPlan.isEnterprise ? (
          <CardFooter className="flex-col items-stretch">
            <a
              href={`mailto:sales@example.com?subject=${encodeURIComponent(`Enterprise inquiry — ${workspaceName}`)}`}
              className={`${buttonVariants({ variant: 'default' })} w-full`}
            >
              Contact Sales
            </a>
          </CardFooter>
        ) : (
          <CardFooter className="flex-col items-stretch">
            <Button variant="outline" className="w-full" onClick={onManagePlan}>
              Manage plan
            </Button>
            {shouldShowBillingPortal && (
              <button
                type="button"
                onClick={onBillingPortal}
                disabled={isBillingPortalLoading}
                className="mt-1 text-center text-xs text-muted-foreground underline hover:text-foreground disabled:opacity-50"
              >
                Billing portal
              </button>
            )}
          </CardFooter>
        )}
      </Card>
    </div>
  );
}
