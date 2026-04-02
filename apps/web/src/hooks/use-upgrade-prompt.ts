import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { PlanDefinition, PlanId } from '@workspace/auth/plans';
import { createWorkspaceCheckoutSession } from '@/billing/billing.functions';

export type UpgradePromptAction =
  | { type: 'checkout'; plan: PlanDefinition }
  | { type: 'contact_sales'; plan: PlanDefinition };

interface UpgradePromptState {
  open: boolean;
  title: string;
  description: string;
  /** The next action to offer. null = highest tier, show limit-reached message. */
  action: UpgradePromptAction | null;
}

const INITIAL_STATE: UpgradePromptState = {
  open: false,
  title: '',
  description: '',
  action: null,
};

/**
 * Encapsulates upgrade prompt dialog state, billing interval toggle,
 * and Stripe checkout mutation. Reusable across any component that
 * gates actions behind plan limits.
 *
 * When action is null (highest tier), the dialog shows a
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
    upgradePlan: PlanDefinition | null
  ) => {
    setPrompt({
      open: true,
      title,
      description,
      action: upgradePlan
        ? {
            type: upgradePlan.isEnterprise ? 'contact_sales' : 'checkout',
            plan: upgradePlan,
          }
        : null,
    });
  };

  const dialogProps = {
    open: prompt.open,
    onOpenChange: (open: boolean) => setPrompt((prev) => ({ ...prev, open })),
    title: prompt.title,
    description: prompt.description,
    action: prompt.action,
    isUpgrading: upgradeMutation.isPending,
    onAction: () => {
      if (prompt.action?.type === 'checkout') {
        upgradeMutation.mutate({
          planId: prompt.action.plan.id,
          annual: isAnnual,
        });
      }
    },
    isAnnual,
    onToggleInterval: setIsAnnual,
  };

  return { show, dialogProps };
}
