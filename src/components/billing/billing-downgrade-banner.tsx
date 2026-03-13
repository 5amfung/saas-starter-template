import { IconAlertCircle, IconLoader2 } from '@tabler/icons-react';
import { Button } from '@/components/ui/button';

interface BillingDowngradeBannerProps {
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
  periodEnd,
  onReactivate,
  isReactivating,
}: BillingDowngradeBannerProps) {
  return (
    <div className="bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800 flex items-center justify-between gap-4 rounded-lg border p-4">
      <div className="flex items-center gap-3">
        <IconAlertCircle className="text-amber-600 dark:text-amber-400 size-4 shrink-0" />
        <p className="text-amber-800 dark:text-amber-200 text-sm">
          Your plan will downgrade to Starter on{' '}
          <span className="font-medium">{DATE_FORMAT.format(periodEnd)}</span>.
        </p>
      </div>
      <Button
        variant="outline"
        size="sm"
        onClick={onReactivate}
        disabled={isReactivating}
        className="border-amber-300 dark:border-amber-700 shrink-0"
      >
        {isReactivating && <IconLoader2 className="size-4 animate-spin" />}
        Keep subscription
      </Button>
    </div>
  );
}
