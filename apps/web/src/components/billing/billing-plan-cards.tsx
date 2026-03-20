import { IconCheck } from '@tabler/icons-react';
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
import { formatPlanPrice, getPlanFeatures } from '@workspace/auth/plans';
import type { Plan, PlanId } from '@workspace/auth/plans';

interface BillingPlanCardsProps {
  currentPlan: Plan;
  upgradePlan: Plan | null;
  /** Next billing date for paid plans. null for free tier. */
  nextBillingDate: Date | null;
  /** Whether the user is on annual billing. */
  isAnnual: boolean;
  onToggleInterval: (annual: boolean) => void;
  onManage: () => void;
  onUpgrade: (planId: PlanId) => void;
  isManaging: boolean;
  isUpgrading: boolean;
}

const DATE_FORMAT = new Intl.DateTimeFormat('en-US', {
  month: 'long',
  day: 'numeric',
  year: 'numeric',
});

export function BillingPlanCards({
  currentPlan,
  upgradePlan,
  nextBillingDate,
  isAnnual,
  onToggleInterval,
  onManage,
  onUpgrade,
  isManaging,
  isUpgrading,
}: BillingPlanCardsProps) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
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
          <CardFooter>
            <Button
              variant="outline"
              className="w-full"
              onClick={onManage}
              disabled={isManaging}
            >
              {isManaging ? 'Opening portal...' : 'Manage subscription'}
            </Button>
          </CardFooter>
        )}
      </Card>

      {/* Upgrade Card */}
      {upgradePlan ? (
        <Card>
          <CardHeader>
            <CardDescription>Upgrade to</CardDescription>
            <CardTitle className="text-2xl">{upgradePlan.name}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              {upgradePlan.pricing && (
                <p className="text-sm font-medium">
                  {formatPlanPrice(upgradePlan, isAnnual)}
                </p>
              )}
              <div className="flex items-center gap-0.5 rounded-full border p-0.5">
                <Toggle
                  pressed={!isAnnual}
                  onPressedChange={() => onToggleInterval(false)}
                  size="sm"
                  className="h-6 rounded-full px-2.5 text-xs aria-pressed:bg-foreground aria-pressed:text-background"
                  aria-label="Monthly billing"
                >
                  Monthly
                </Toggle>
                <Toggle
                  pressed={isAnnual}
                  onPressedChange={() => onToggleInterval(true)}
                  size="sm"
                  className="h-6 rounded-full px-2.5 text-xs aria-pressed:bg-foreground aria-pressed:text-background"
                  aria-label="Annual billing"
                >
                  Annual
                </Toggle>
              </div>
            </div>
            <ul className="mt-1 flex flex-col gap-2">
              {getPlanFeatures(upgradePlan, isAnnual).map((feature) => (
                <li key={feature} className="flex items-center gap-2 text-sm">
                  <IconCheck className="size-3.5 shrink-0 text-primary" />
                  {feature}
                </li>
              ))}
            </ul>
          </CardContent>
          <CardFooter>
            <Button
              className="w-full"
              onClick={() => onUpgrade(upgradePlan.id)}
              disabled={isUpgrading}
            >
              {isUpgrading
                ? 'Redirecting...'
                : `Upgrade to ${upgradePlan.name}`}
            </Button>
          </CardFooter>
        </Card>
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
