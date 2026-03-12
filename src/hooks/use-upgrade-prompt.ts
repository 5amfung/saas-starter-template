import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { createCheckoutSession } from '@/billing/billing.functions';

interface UpgradePromptState {
  open: boolean;
  title: string;
  description: string;
}

const INITIAL_STATE: UpgradePromptState = {
  open: false,
  title: '',
  description: '',
};

/**
 * Encapsulates upgrade prompt dialog state, billing interval toggle,
 * and Stripe checkout mutation. Reusable across any component that
 * gates actions behind plan limits.
 */
export function useUpgradePrompt() {
  const [prompt, setPrompt] = useState<UpgradePromptState>(INITIAL_STATE);
  const [isAnnual, setIsAnnual] = useState(false);

  const upgradeMutation = useMutation({
    mutationFn: (annual: boolean) =>
      createCheckoutSession({
        data: { planId: annual ? 'pro-annual' : 'pro-monthly' },
      }),
    onSuccess: (result) => {
      if (result.url) {
        window.location.href = result.url;
      }
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to start checkout.');
    },
  });

  const show = (title: string, description: string) => {
    setPrompt({ open: true, title, description });
  };

  const dialogProps = {
    open: prompt.open,
    onOpenChange: (open: boolean) => setPrompt((prev) => ({ ...prev, open })),
    title: prompt.title,
    description: prompt.description,
    isUpgrading: upgradeMutation.isPending,
    onUpgrade: () => upgradeMutation.mutate(isAnnual),
    isAnnual,
    onToggleInterval: setIsAnnual,
  };

  return { show, dialogProps };
}
