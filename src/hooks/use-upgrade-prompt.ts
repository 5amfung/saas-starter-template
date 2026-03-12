import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { createCheckoutSession } from '@/billing/billing.functions';
import type { Plan, PlanId } from '@/billing/plans';
import { PLANS, PLAN_GROUP } from '@/billing/plans';

interface UpgradePromptState {
  open: boolean;
  title: string;
  description: string;
  /** The plan to offer. null = highest tier, show limit-reached message. */
  upgradePlan: Plan | null;
}

const INITIAL_STATE: UpgradePromptState = {
  open: false,
  title: '',
  description: '',
  upgradePlan: null,
};

/**
 * Encapsulates upgrade prompt dialog state, billing interval toggle,
 * and Stripe checkout mutation. Reusable across any component that
 * gates actions behind plan limits.
 *
 * When upgradePlan is null (highest tier), the dialog shows a
 * "limit reached" message instead of a checkout offer.
 */
export function useUpgradePrompt() {
  const [prompt, setPrompt] = useState<UpgradePromptState>(INITIAL_STATE);
  const [isAnnual, setIsAnnual] = useState(false);

  const upgradeMutation = useMutation({
    mutationFn: (planId: PlanId) => createCheckoutSession({ data: { planId } }),
    onSuccess: (result) => {
      if (result.url) {
        window.location.href = result.url;
      }
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to start checkout.');
    },
  });

  const show = (
    title: string,
    description: string,
    upgradePlan: Plan | null,
  ) => {
    setPrompt({ open: true, title, description, upgradePlan });
  };

  /** Resolves the correct plan variant (monthly/annual) for checkout. */
  const getUpgradePlanVariant = (): Plan | null => {
    const { upgradePlan } = prompt;
    if (!upgradePlan) return null;
    if (!isAnnual) return upgradePlan;
    // Find the annual variant of the same plan group.
    const group = PLAN_GROUP[upgradePlan.id];
    return (
      PLANS.find((p) => PLAN_GROUP[p.id] === group && p.interval === 'year') ??
      upgradePlan
    );
  };

  const resolvedPlan = getUpgradePlanVariant();

  const dialogProps = {
    open: prompt.open,
    onOpenChange: (open: boolean) => setPrompt((prev) => ({ ...prev, open })),
    title: prompt.title,
    description: prompt.description,
    upgradePlan: resolvedPlan,
    isUpgrading: upgradeMutation.isPending,
    onUpgrade: () => {
      if (resolvedPlan) {
        upgradeMutation.mutate(resolvedPlan.id);
      }
    },
    isAnnual,
    onToggleInterval: setIsAnnual,
  };

  return { show, dialogProps };
}
