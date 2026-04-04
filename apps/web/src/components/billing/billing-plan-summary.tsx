import { IconCheck } from '@tabler/icons-react';
import { describeEntitlements, formatPlanPrice } from '@workspace/billing';
import { cn } from '@workspace/ui/lib/utils';
import type { Entitlements, PlanDefinition } from '@workspace/billing';

interface BillingPlanSummaryProps {
  plan: PlanDefinition;
  annual?: boolean;
  entitlements?: Entitlements;
  showHeader?: boolean;
  showName?: boolean;
  showPrice?: boolean;
  showFeatures?: boolean;
  className?: string;
  headerClassName?: string;
  nameClassName?: string;
  priceClassName?: string;
  featuresClassName?: string;
  featureItemClassName?: string;
  featureIconClassName?: string;
}

export function BillingPlanSummary({
  plan,
  annual = false,
  entitlements,
  showHeader = true,
  showName = true,
  showPrice = true,
  showFeatures = true,
  className,
  headerClassName,
  nameClassName,
  priceClassName,
  featuresClassName,
  featureItemClassName,
  featureIconClassName,
}: BillingPlanSummaryProps) {
  const summaryEntitlements = entitlements ?? plan.entitlements;

  return (
    <div className={cn('flex flex-col gap-3', className)}>
      {showHeader && (
        <div className={cn('flex flex-col gap-1', headerClassName)}>
          {showName && (
            <p className={cn('text-base font-semibold', nameClassName)}>
              {plan.name}
            </p>
          )}
          {showPrice && (
            <span
              className={cn('text-sm text-muted-foreground', priceClassName)}
            >
              {plan.isEnterprise
                ? 'Custom pricing'
                : !plan.pricing
                  ? 'Free forever'
                  : formatPlanPrice(plan, annual)}
            </span>
          )}
        </div>
      )}

      {showFeatures && (
        <ul className={cn('flex flex-col gap-2', featuresClassName)}>
          {describeEntitlements(summaryEntitlements).map((feature) => (
            <li
              key={feature}
              className={cn(
                'flex items-center gap-2 text-sm',
                featureItemClassName
              )}
            >
              <IconCheck
                className={cn(
                  'size-3.5 shrink-0 text-primary',
                  featureIconClassName
                )}
              />
              {feature}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
