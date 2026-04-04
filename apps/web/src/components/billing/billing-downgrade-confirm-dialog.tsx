import { IconAlertTriangle, IconCheck, IconLoader2 } from '@tabler/icons-react';
import { describeEntitlements, formatPlanPrice } from '@workspace/billing';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@workspace/ui/components/alert-dialog';
import type { PlanDefinition } from '@workspace/billing';

const DATE_FORMAT = new Intl.DateTimeFormat('en-US', {
  month: 'long',
  day: 'numeric',
  year: 'numeric',
  timeZone: 'UTC',
});

interface BillingDowngradeConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentPlan: PlanDefinition;
  targetPlan: PlanDefinition;
  periodEnd: Date | null;
  currentMemberCount: number;
  onConfirm: () => void;
  isProcessing: boolean;
}

export function BillingDowngradeConfirmDialog({
  open,
  onOpenChange,
  currentPlan,
  targetPlan,
  periodEnd,
  currentMemberCount,
  onConfirm,
  isProcessing,
}: BillingDowngradeConfirmDialogProps) {
  const exceedsMemberLimit =
    targetPlan.entitlements.limits.members !== -1 &&
    currentMemberCount > targetPlan.entitlements.limits.members;

  const descriptionText = periodEnd
    ? `Your ${currentPlan.name} plan will remain active until ${DATE_FORMAT.format(periodEnd)}. After that, you will downgrade to:`
    : `You will downgrade to:`;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Downgrade to {targetPlan.name}?</AlertDialogTitle>
          <AlertDialogDescription>{descriptionText}</AlertDialogDescription>
        </AlertDialogHeader>

        <div className="rounded-lg border bg-muted/20 p-4">
          <p className="text-lg font-semibold">{targetPlan.name}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {targetPlan.isEnterprise
              ? 'Custom pricing'
              : !targetPlan.pricing
                ? 'Free forever'
                : formatPlanPrice(targetPlan, false)}
          </p>
          <ul className="mt-3 space-y-1 text-sm text-muted-foreground">
            {describeEntitlements(targetPlan.entitlements).map((feature) => (
              <li key={feature} className="flex items-center gap-2">
                <IconCheck className="size-3.5 shrink-0 text-primary" />
                {feature}
              </li>
            ))}
          </ul>
        </div>

        {/* Member count warning shown when workspace exceeds the target plan's member limit. */}
        {exceedsMemberLimit && (
          <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-400">
            <IconAlertTriangle className="mt-0.5 size-4 shrink-0" />
            <p>
              Any areas exceeding the new plan limits will stop working after
              the downgrade takes effect.
            </p>
          </div>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={isProcessing}
            onClick={(event) => {
              event.preventDefault();
              onConfirm();
            }}
          >
            {isProcessing && <IconLoader2 className="size-4 animate-spin" />}
            Confirm downgrade
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
