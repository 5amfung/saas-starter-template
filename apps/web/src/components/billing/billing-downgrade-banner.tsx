import { IconAlertCircle, IconLoader2 } from '@tabler/icons-react';
import { Button } from '@workspace/ui/components/button';

interface BillingDowngradeBannerProps {
  targetPlanName: string;
  periodEnd: Date;
  onReactivate: () => void;
  isReactivating: boolean;
}

const DATE_FORMAT = new Intl.DateTimeFormat('en-US', {
  month: 'long',
  day: 'numeric',
  year: 'numeric',
});

export function BillingDowngradeBanner({
  targetPlanName,
  periodEnd,
  onReactivate,
  isReactivating,
}: BillingDowngradeBannerProps) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950/30">
      <div className="flex items-center gap-3">
        <IconAlertCircle className="size-4 shrink-0 text-amber-600 dark:text-amber-400" />
        <p className="text-sm text-amber-800 dark:text-amber-200">
          Your plan will downgrade to {targetPlanName} on{' '}
          <span className="font-medium">{DATE_FORMAT.format(periodEnd)}</span>.
        </p>
      </div>
      <Button
        variant="outline"
        size="sm"
        onClick={onReactivate}
        disabled={isReactivating}
        className="shrink-0 border-amber-300 dark:border-amber-700"
      >
        {isReactivating && <IconLoader2 className="size-4 animate-spin" />}
        Keep subscription
      </Button>
    </div>
  );
}
