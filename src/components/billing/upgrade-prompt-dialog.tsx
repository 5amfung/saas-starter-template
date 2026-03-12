import { IconCheck, IconLoader2, IconSparkles } from '@tabler/icons-react';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Toggle } from '@/components/ui/toggle';
import { PLANS } from '@/billing/plans';
import type { Plan } from '@/billing/plans';

const proMonthly = PLANS.find((p) => p.id === 'pro-monthly')!;
const proAnnual = PLANS.find((p) => p.id === 'pro-annual')!;

const CURRENCY_FORMAT = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 0,
});

function formatPrice(plan: Plan): string {
  if (plan.price === 0) return '';
  const monthly =
    plan.interval === 'year' ? plan.price / 12 / 100 : plan.price / 100;
  return `${CURRENCY_FORMAT.format(monthly)}/mo`;
}

interface UpgradePromptDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  isUpgrading: boolean;
  onUpgrade: () => void;
  isAnnual: boolean;
  onToggleInterval: (annual: boolean) => void;
}

export function UpgradePromptDialog({
  open,
  onOpenChange,
  title,
  description,
  isUpgrading,
  onUpgrade,
  isAnnual,
  onToggleInterval,
}: UpgradePromptDialogProps) {
  const plan = isAnnual ? proAnnual : proMonthly;
  const priceLabel = formatPrice(plan);

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent size="sm" className="gap-0 p-0">
        {/* Accessible title — visually hidden, used by screen readers. */}
        <AlertDialogTitle className="sr-only">{title}</AlertDialogTitle>

        {/* Context banner — explains why the dialog appeared. */}
        <div className="bg-muted/50 flex items-center gap-3 rounded-t-xl px-7 py-4">
          <IconSparkles className="text-muted-foreground size-4 shrink-0" />
          <AlertDialogDescription className="text-muted-foreground text-xs">
            {description}
          </AlertDialogDescription>
        </div>

        {/* Plan offer */}
        <div className="flex flex-col gap-6 p-7">
          {/* Plan name + price + toggle */}
          <div className="flex flex-col gap-4">
            <div className="flex items-baseline gap-2">
              <h3 className="text-xl font-semibold tracking-tight">
                {plan.name}
              </h3>
              {priceLabel && (
                <span className="text-muted-foreground text-sm">
                  {priceLabel}
                </span>
              )}
            </div>

            <div className="flex items-center gap-0.5 self-start rounded-full border p-0.5">
              <Toggle
                pressed={!isAnnual}
                onPressedChange={() => onToggleInterval(false)}
                size="sm"
                className="aria-pressed:bg-foreground aria-pressed:text-background h-6 rounded-full px-2.5 text-xs"
                aria-label="Monthly billing"
              >
                Monthly
              </Toggle>
              <Toggle
                pressed={isAnnual}
                onPressedChange={() => onToggleInterval(true)}
                size="sm"
                className="aria-pressed:bg-foreground aria-pressed:text-background h-6 rounded-full px-2.5 text-xs"
                aria-label="Annual billing"
              >
                Annual
              </Toggle>
            </div>
          </div>

          {/* Features */}
          <ul className="flex flex-col gap-2.5">
            {plan.features.map((feature) => (
              <li key={feature} className="flex items-center gap-2.5 text-sm">
                <IconCheck className="text-primary size-3.5 shrink-0" />
                {feature}
              </li>
            ))}
          </ul>

          {/* Actions */}
          <div className="flex flex-col items-center gap-3 pt-1">
            <Button
              className="w-full"
              disabled={isUpgrading}
              onClick={onUpgrade}
            >
              {isUpgrading && <IconLoader2 className="size-4 animate-spin" />}
              Upgrade to {plan.name}
            </Button>
            <AlertDialogCancel
              variant="link"
              size="sm"
              disabled={isUpgrading}
              className="text-muted-foreground h-auto border-0 px-0 py-1 text-xs shadow-none"
            >
              Maybe later
            </AlertDialogCancel>
          </div>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  );
}
