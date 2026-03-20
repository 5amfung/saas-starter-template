import { IconCheck, IconLoader2, IconSparkles } from '@tabler/icons-react';
import { formatPlanPrice, getPlanFeatures } from '@workspace/auth/plans';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
} from '@workspace/ui/components/alert-dialog';
import { Button } from '@workspace/ui/components/button';
import { Toggle } from '@workspace/ui/components/toggle';
import type { Plan } from '@workspace/auth/plans';

interface UpgradePromptDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  /** The plan to offer. null = show limit-reached message. */
  upgradePlan: Plan | null;
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
  upgradePlan,
  isUpgrading,
  onUpgrade,
  isAnnual,
  onToggleInterval,
}: UpgradePromptDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent size="sm" className="gap-0 p-0">
        {/* Accessible title — visually hidden, used by screen readers. */}
        <AlertDialogTitle className="sr-only">{title}</AlertDialogTitle>

        {/* Context banner — explains why the dialog appeared. */}
        <div className="flex items-center gap-3 rounded-t-xl bg-muted/50 px-7 py-4">
          <IconSparkles className="size-4 shrink-0 text-muted-foreground" />
          <AlertDialogDescription className="text-xs text-muted-foreground">
            {description}
          </AlertDialogDescription>
        </div>

        <div className="flex flex-col gap-6 p-7">
          {upgradePlan ? (
            <>
              {/* Plan name + price + toggle */}
              <div className="flex flex-col gap-4">
                <div className="flex items-baseline gap-2">
                  <h3 className="text-xl font-semibold tracking-tight">
                    {upgradePlan.name}
                  </h3>
                  {upgradePlan.pricing && (
                    <span className="text-sm text-muted-foreground">
                      {formatPlanPrice(upgradePlan, isAnnual)}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-0.5 self-start rounded-full border p-0.5">
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

              {/* Features */}
              <ul className="flex flex-col gap-2.5">
                {getPlanFeatures(upgradePlan, isAnnual).map((feature) => (
                  <li
                    key={feature}
                    className="flex items-center gap-2.5 text-sm"
                  >
                    <IconCheck className="size-3.5 shrink-0 text-primary" />
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
                  {isUpgrading && (
                    <IconLoader2 className="size-4 animate-spin" />
                  )}
                  Upgrade to {upgradePlan.name}
                </Button>
                <AlertDialogCancel
                  variant="link"
                  size="sm"
                  disabled={isUpgrading}
                  className="h-auto border-0 px-0 py-1 text-xs text-muted-foreground shadow-none"
                >
                  Maybe later
                </AlertDialogCancel>
              </div>
            </>
          ) : (
            /* Limit-reached message — no upgrade available. */
            <div className="flex flex-col items-center gap-3 pt-1">
              <p className="text-center text-sm text-muted-foreground">
                You've reached the limits of your current plan. Contact us for a
                custom plan tailored to your needs.
              </p>
              <AlertDialogCancel variant="outline" size="sm" className="mt-2">
                Got it
              </AlertDialogCancel>
            </div>
          )}
        </div>
      </AlertDialogContent>
    </AlertDialog>
  );
}
