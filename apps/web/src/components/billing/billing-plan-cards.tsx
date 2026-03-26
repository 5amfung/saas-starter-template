import { IconCheck } from '@tabler/icons-react';
import { formatPlanPrice, getPlanFeatures } from '@workspace/auth/plans';
import { Button } from '@workspace/ui/components/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@workspace/ui/components/card';
import { Toggle } from '@workspace/ui/components/toggle';
import type { Plan, PlanId } from '@workspace/auth/plans';

interface BillingPlanCardsProps {
  currentPlan: Plan;
  upgradePlans: Array<Plan>;
  /** Next billing date for paid plans. null for free tier. */
  nextBillingDate: Date | null;
  /** Per-plan annual toggle state. Missing keys default to monthly. */
  annualByPlan: Partial<Record<PlanId, boolean>>;
  onToggleInterval: (planId: PlanId, annual: boolean) => void;
  onManagePlan: () => void;
  onUpgrade: (planId: PlanId, annual: boolean) => void;
  onBillingPortal: () => void;
  isManaging: boolean;
  isBillingPortalLoading: boolean;
  /** The plan ID currently being upgraded, or null if no checkout in progress. */
  upgradingPlanId: PlanId | null;
}

const DATE_FORMAT = new Intl.DateTimeFormat('en-US', {
  month: 'long',
  day: 'numeric',
  year: 'numeric',
});

export function BillingPlanCards({
  currentPlan,
  upgradePlans,
  nextBillingDate,
  annualByPlan,
  onToggleInterval,
  onManagePlan,
  onUpgrade,
  onBillingPortal,
  isManaging,
  isBillingPortalLoading,
  upgradingPlanId,
}: BillingPlanCardsProps) {
  return (
    <div className="flex flex-col gap-4">
      {/* Current Plan Card */}
      <Card>
        <CardHeader>
          <CardDescription>Current plan</CardDescription>
          <CardTitle className="text-2xl">{currentPlan.name}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <p className="text-sm text-muted-foreground">
            {!currentPlan.pricing
              ? 'Free forever'
              : formatPlanPrice(currentPlan, false)}
          </p>
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
        </CardContent>
        {currentPlan.pricing && (
          <CardFooter className="flex-col items-stretch">
            <Button
              variant="outline"
              className="w-full"
              onClick={onManagePlan}
              disabled={isManaging}
            >
              {isManaging ? 'Opening...' : 'Manage plan'}
            </Button>
            <button
              type="button"
              onClick={onBillingPortal}
              disabled={isBillingPortalLoading}
              className="mt-1 text-center text-xs text-muted-foreground underline hover:text-foreground disabled:opacity-50"
            >
              Billing portal
            </button>
          </CardFooter>
        )}
      </Card>

      {/* Upgrade Cards */}
      {upgradePlans.length > 0 ? (
        upgradePlans.map((plan) => {
          const isAnnual = annualByPlan[plan.id] ?? false;
          const isThisPlanUpgrading = upgradingPlanId === plan.id;

          return (
            <Card key={plan.id}>
              <CardHeader>
                <CardDescription>Upgrade to</CardDescription>
                <CardTitle className="text-2xl">{plan.name}</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                <div className="flex items-center gap-2">
                  {plan.pricing && (
                    <p className="text-sm font-medium">
                      {formatPlanPrice(plan, isAnnual)}
                    </p>
                  )}
                  <div className="flex items-center gap-0.5 rounded-full border p-0.5">
                    <Toggle
                      pressed={!isAnnual}
                      onPressedChange={() => onToggleInterval(plan.id, false)}
                      size="sm"
                      className="h-6 rounded-full px-2.5 text-xs aria-pressed:bg-foreground aria-pressed:text-background"
                      aria-label="Monthly billing"
                    >
                      Monthly
                    </Toggle>
                    <Toggle
                      pressed={isAnnual}
                      onPressedChange={() => onToggleInterval(plan.id, true)}
                      size="sm"
                      className="h-6 rounded-full px-2.5 text-xs aria-pressed:bg-foreground aria-pressed:text-background"
                      aria-label="Annual billing"
                    >
                      Annual
                    </Toggle>
                  </div>
                </div>
                <ul className="mt-1 flex flex-col gap-2">
                  {getPlanFeatures(plan, isAnnual).map((feature) => (
                    <li
                      key={feature}
                      className="flex items-center gap-2 text-sm"
                    >
                      <IconCheck className="size-3.5 shrink-0 text-primary" />
                      {feature}
                    </li>
                  ))}
                </ul>
              </CardContent>
              <CardFooter>
                <Button
                  className="w-full"
                  onClick={() => onUpgrade(plan.id, isAnnual)}
                  disabled={upgradingPlanId !== null}
                >
                  {isThisPlanUpgrading
                    ? 'Redirecting...'
                    : `Upgrade to ${plan.name}`}
                </Button>
              </CardFooter>
            </Card>
          );
        })
      ) : (
        <Card>
          <CardHeader>
            <CardDescription>Need more?</CardDescription>
            <CardTitle className="text-2xl">Custom plan</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              You're on our best plan. Contact us for a custom plan tailored to
              your needs.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
