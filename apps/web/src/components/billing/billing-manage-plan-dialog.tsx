import { useState } from 'react';

import { IconCheck } from '@tabler/icons-react';
import {
  PLANS,
  PLAN_ACTION_CONFIG,
  describeEntitlements,
  formatPlanPrice,
  getPlanAction,
} from '@workspace/billing';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
} from '@workspace/ui/components/alert-dialog';
import { Button, buttonVariants } from '@workspace/ui/components/button';
import { Toggle } from '@workspace/ui/components/toggle';
import type { PlanDefinition, PlanId } from '@workspace/billing';

interface BillingManagePlanDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentPlan: PlanDefinition;
  isPendingCancel: boolean;
  isPendingDowngrade: boolean;
  onUpgrade: (planId: PlanId, annual: boolean) => void;
  onDowngrade: (targetPlan: PlanDefinition, annual: boolean) => void;
  isProcessing: boolean;
  /** Workspace name for enterprise mailto link subject. */
  workspaceName: string;
}

export function BillingManagePlanDialog({
  open,
  onOpenChange,
  currentPlan,
  isPendingCancel,
  isPendingDowngrade,
  onUpgrade,
  onDowngrade,
  isProcessing,
  workspaceName,
}: BillingManagePlanDialogProps) {
  const [isAnnual, setIsAnnual] = useState(false);

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="h-full! max-w-none! gap-0 overflow-y-auto rounded-none! p-0 sm:h-auto! sm:max-w-[56rem]! sm:rounded-xl!">
        <AlertDialogTitle className="sr-only">
          Manage your plan
        </AlertDialogTitle>

        {/* Header */}
        <div className="flex flex-col gap-4 px-7 pt-7">
          <div className="flex flex-col gap-1">
            <h2 className="text-lg font-semibold tracking-tight">
              Manage your plan
            </h2>
            <AlertDialogDescription className="text-sm text-muted-foreground">
              Current plan: {currentPlan.name}
            </AlertDialogDescription>
          </div>

          {/* Billing interval toggle */}
          <div className="flex items-center gap-0.5 self-start rounded-full border p-0.5">
            <Toggle
              pressed={!isAnnual}
              onPressedChange={() => setIsAnnual(false)}
              size="sm"
              className="h-6 rounded-full px-2.5 text-xs aria-pressed:bg-foreground aria-pressed:text-background"
              aria-label="Monthly billing"
            >
              Monthly
            </Toggle>
            <Toggle
              pressed={isAnnual}
              onPressedChange={() => setIsAnnual(true)}
              size="sm"
              className="h-6 rounded-full px-2.5 text-xs aria-pressed:bg-foreground aria-pressed:text-background"
              aria-label="Annual billing"
            >
              Annual
            </Toggle>
          </div>
        </div>

        {/* Pending cancellation notice */}
        {isPendingCancel && (
          <p className="px-7 pt-4 text-sm text-destructive">
            Your plan has a pending cancellation. No further changes can be made
            until the current billing period ends.
          </p>
        )}

        {/* Pending downgrade notice — upgrades are still allowed. */}
        {isPendingDowngrade && !isPendingCancel && (
          <p className="px-7 pt-4 text-sm text-amber-600 dark:text-amber-400">
            A downgrade is scheduled for the end of the current billing period.
            You can still upgrade your plan.
          </p>
        )}

        {/* Plan cards */}
        <div className="flex flex-col gap-4 p-7 md:flex-row">
          {PLANS.map((plan) => {
            const action = getPlanAction(currentPlan, plan);
            const config = PLAN_ACTION_CONFIG[action];
            const isCurrent = action === 'current';
            const isDowngradeOrCancel =
              action === 'downgrade' || action === 'cancel';
            const isDisabled =
              isProcessing ||
              isCurrent ||
              isPendingCancel ||
              (isPendingDowngrade && isDowngradeOrCancel);

            return (
              <div
                key={plan.id}
                className="flex flex-1 flex-col gap-4 rounded-lg border p-5"
              >
                {/* Plan name + price */}
                <div className="flex flex-col gap-1">
                  <h3 className="text-base font-semibold">{plan.name}</h3>
                  <span className="text-sm text-muted-foreground">
                    {plan.isEnterprise
                      ? 'Custom pricing'
                      : plan.pricing
                        ? formatPlanPrice(plan, isAnnual)
                        : 'Free forever'}
                  </span>
                </div>

                {/* Features */}
                <ul className="flex flex-1 flex-col gap-2">
                  {describeEntitlements(plan.entitlements).map((feature) => (
                    <li
                      key={feature}
                      className="flex items-center gap-2 text-sm"
                    >
                      <IconCheck className="size-3.5 shrink-0 text-primary" />
                      {feature}
                    </li>
                  ))}
                </ul>

                {/* Action button */}
                {action === 'contact_sales' ? (
                  <a
                    href={`mailto:sales@example.com?subject=${encodeURIComponent(`Enterprise inquiry — ${workspaceName}`)}`}
                    className={buttonVariants({ variant: config.variant })}
                  >
                    {config.label}
                  </a>
                ) : (
                  <Button
                    variant={config.variant}
                    disabled={isDisabled}
                    onClick={() => {
                      if (action === 'upgrade') {
                        onUpgrade(plan.id, isAnnual);
                      } else if (
                        action === 'downgrade' ||
                        action === 'cancel'
                      ) {
                        onDowngrade(plan, isAnnual);
                      }
                    }}
                  >
                    {config.label}
                  </Button>
                )}
              </div>
            );
          })}
        </div>

        {/* Close button */}
        <div className="flex justify-end px-7 pb-7">
          <AlertDialogCancel variant="outline" size="sm">
            Close
          </AlertDialogCancel>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  );
}
