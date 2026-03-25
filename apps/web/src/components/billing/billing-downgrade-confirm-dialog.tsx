import { IconAlertTriangle, IconLoader2 } from '@tabler/icons-react';
import { computePlanDiff } from '@workspace/auth/plans';
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
import type { Plan } from '@workspace/auth/plans';

const DATE_FORMAT = new Intl.DateTimeFormat('en-US', {
  month: 'long',
  day: 'numeric',
  year: 'numeric',
  timeZone: 'UTC',
});

interface BillingDowngradeConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentPlan: Plan;
  targetPlan: Plan;
  periodEnd: Date | null;
  currentMemberCount: number;
  onConfirm: () => void;
  isProcessing: boolean;
}

/**
 * Filters out lost features that are already represented by limit changes.
 * Avoids redundant display when a numeric limit change captures the same information
 * (e.g., "Up to 25 members" when there is already a "Member limit: 25 → 5" entry).
 */
function filterRedundantFeatures(
  lostFeatures: Array<string>,
  limitFromValues: Set<string>
): Array<string> {
  return lostFeatures.filter(
    (feature) => !Array.from(limitFromValues).some((v) => feature.includes(v))
  );
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
  const { lostFeatures, limitChanges } = computePlanDiff(
    currentPlan,
    targetPlan
  );

  const limitFromValues = new Set(limitChanges.map((c) => String(c.from)));
  const displayedFeatures = filterRedundantFeatures(
    lostFeatures,
    limitFromValues
  );

  const exceedsMemberLimit =
    targetPlan.limits.maxMembers !== -1 &&
    currentMemberCount > targetPlan.limits.maxMembers;

  // Build the full summary as a single string so all content is in one text
  // node. This keeps test queries (getByText) unambiguous — each query finds
  // exactly one element — while also serving as the accessible description for
  // screen readers.
  const limitSummary = limitChanges
    .map((c) => `${c.label} drops from ${c.from} → ${c.to}`)
    .join(', ');

  const featureSummary =
    displayedFeatures.length > 0
      ? `${displayedFeatures.join(', ')} will no longer be available`
      : '';

  const afterChanges = [limitSummary, featureSummary]
    .filter(Boolean)
    .join('. ');

  const descriptionText = periodEnd
    ? `Your ${currentPlan.name} plan will remain active until ${DATE_FORMAT.format(periodEnd)}. After that: ${afterChanges}.`
    : `After downgrading to ${targetPlan.name}: ${afterChanges}.`;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Downgrade to {targetPlan.name}?</AlertDialogTitle>
          <AlertDialogDescription>{descriptionText}</AlertDialogDescription>
        </AlertDialogHeader>

        {/* Member count warning shown when workspace exceeds the target plan's member limit. */}
        {exceedsMemberLimit && (
          <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-400">
            <IconAlertTriangle className="mt-0.5 size-4 shrink-0" />
            <p>
              You currently have {currentMemberCount} members. The{' '}
              {targetPlan.name} plan allows up to {targetPlan.limits.maxMembers}
              . You'll need to remove members before the change takes effect.
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
