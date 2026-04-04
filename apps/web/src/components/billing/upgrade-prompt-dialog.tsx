import { IconLoader2, IconSparkles } from '@tabler/icons-react';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
} from '@workspace/ui/components/alert-dialog';
import { Button, buttonVariants } from '@workspace/ui/components/button';
import { Toggle } from '@workspace/ui/components/toggle';
import type { UpgradePromptAction } from '@/hooks/use-upgrade-prompt';
import { BillingPlanSummary } from './billing-plan-summary';

interface UpgradePromptDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  /** The action to offer. null = show limit-reached message. */
  action: UpgradePromptAction | null;
  isUpgrading: boolean;
  onAction: () => void;
  isAnnual: boolean;
  onToggleInterval: (annual: boolean) => void;
  workspaceName?: string;
}

export function UpgradePromptDialog({
  open,
  onOpenChange,
  title,
  description,
  action,
  isUpgrading,
  onAction,
  isAnnual,
  onToggleInterval,
  workspaceName = 'Workspace',
}: UpgradePromptDialogProps) {
  const actionPlan = action?.plan ?? null;
  const isCheckout = action?.type === 'checkout';
  const isContactSales = action?.type === 'contact_sales';

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
          {actionPlan ? (
            <>
              {/* Plan name + price + toggle */}
              <div className="flex flex-col gap-4">
                <BillingPlanSummary
                  plan={actionPlan}
                  annual={isAnnual}
                  headerClassName="flex items-baseline gap-2"
                  nameClassName="text-xl font-semibold tracking-tight"
                  showFeatures={false}
                />

                {isCheckout ? (
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
                ) : null}
              </div>

              <BillingPlanSummary
                plan={actionPlan}
                annual={isAnnual}
                showHeader={false}
                featuresClassName="gap-2.5"
                featureItemClassName="gap-2.5"
              />

              {/* Actions */}
              <div className="flex flex-col items-center gap-3 pt-1">
                {isContactSales ? (
                  <a
                    href={`mailto:sales@example.com?subject=${encodeURIComponent(`Enterprise inquiry — ${workspaceName}`)}`}
                    className={`${buttonVariants()} w-full`}
                  >
                    Contact Sales
                  </a>
                ) : (
                  <Button
                    className="w-full"
                    disabled={isUpgrading}
                    onClick={onAction}
                  >
                    {isUpgrading && (
                      <IconLoader2 className="size-4 animate-spin" />
                    )}
                    Upgrade to {actionPlan.name}
                  </Button>
                )}
                <AlertDialogCancel
                  variant="link"
                  size="sm"
                  disabled={isUpgrading && isCheckout}
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
