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
import { BillingPlanSummary } from './billing-plan-summary';

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
          <BillingPlanSummary
            plan={currentPlan}
            annual={false}
            entitlements={currentEntitlements}
            className="gap-0"
            showName={false}
            showFeatures={false}
          />
          {nextBillingDate && (
            <p className="text-sm text-muted-foreground">
              Renews on {DATE_FORMAT.format(nextBillingDate)}
            </p>
          )}
          <BillingPlanSummary
            plan={currentPlan}
            annual={false}
            entitlements={currentEntitlements}
            className="gap-0"
            showHeader={false}
            featuresClassName="mt-1 gap-2"
            featureIconClassName="text-muted-foreground"
          />
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
