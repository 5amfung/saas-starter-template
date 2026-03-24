import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { Plan, PlanId } from '@workspace/auth/plans';
import { createWorkspaceCheckoutSession } from '@/billing/billing.functions';

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
export function useUpgradePrompt(workspaceId: string) {
  const [prompt, setPrompt] = useState<UpgradePromptState>(INITIAL_STATE);
  const [isAnnual, setIsAnnual] = useState(false);

  const upgradeMutation = useMutation({
    mutationFn: ({ planId, annual }: { planId: PlanId; annual: boolean }) =>
      createWorkspaceCheckoutSession({ data: { workspaceId, planId, annual } }),
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
    upgradePlan: Plan | null
  ) => {
    setPrompt({ open: true, title, description, upgradePlan });
  };

  const dialogProps = {
    open: prompt.open,
    onOpenChange: (open: boolean) => setPrompt((prev) => ({ ...prev, open })),
    title: prompt.title,
    description: prompt.description,
    upgradePlan: prompt.upgradePlan,
    isUpgrading: upgradeMutation.isPending,
    onUpgrade: () => {
      if (prompt.upgradePlan) {
        upgradeMutation.mutate({
          planId: prompt.upgradePlan.id,
          annual: isAnnual,
        });
      }
    },
    isAnnual,
    onToggleInterval: setIsAnnual,
  };

  return { show, dialogProps };
}
