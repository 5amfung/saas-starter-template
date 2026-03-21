import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { getUpgradePlans } from '@workspace/auth/plans';
import { Card, CardContent } from '@workspace/ui/components/card';
import { BillingDowngradeBanner } from './billing-downgrade-banner';
import { BillingInvoiceTable } from './billing-invoice-table';
import { BillingPlanCards } from './billing-plan-cards';
import type { PlanId } from '@workspace/auth/plans';
import { SESSION_QUERY_KEY } from '@/hooks/use-session-query';
import {
  createCheckoutSession,
  createPortalSession,
  getInvoices,
  getUserBillingData,
  reactivateSubscription,
} from '@/billing/billing.functions';

const PAGE_LAYOUT_CLASS =
  'mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-4 md:py-6 lg:px-6';

const INVOICES_QUERY_KEY = ['billing', 'invoices'] as const;
const BILLING_DATA_QUERY_KEY = ['billing', 'data'] as const;

export function BillingPage() {
  const queryClient = useQueryClient();
  const [annualByPlan, setAnnualByPlan] = useState<
    Partial<Record<PlanId, boolean>>
  >({});
  const [upgradingPlanId, setUpgradingPlanId] = useState<PlanId | null>(null);

  const billingQuery = useQuery({
    queryKey: BILLING_DATA_QUERY_KEY,
    queryFn: () => getUserBillingData(),
  });

  const invoicesQuery = useQuery({
    queryKey: INVOICES_QUERY_KEY,
    queryFn: () => getInvoices(),
  });

  const manageMutation = useMutation({
    mutationFn: () => createPortalSession(),
    onSuccess: (result) => {
      if (result.url) {
        window.location.href = result.url;
      }
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to open billing portal.');
    },
  });

  const upgradeMutation = useMutation({
    mutationFn: ({ planId, annual }: { planId: PlanId; annual: boolean }) =>
      createCheckoutSession({ data: { planId, annual } }),
    onMutate: ({ planId }) => {
      setUpgradingPlanId(planId);
    },
    onSuccess: (result) => {
      if (result.url) {
        window.location.href = result.url;
      }
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to start checkout.');
    },
    onSettled: () => {
      setUpgradingPlanId(null);
    },
  });

  const reactivateMutation = useMutation({
    mutationFn: () => reactivateSubscription(),
    onSuccess: () => {
      toast.success('Subscription reactivated.');
      void queryClient.invalidateQueries({ queryKey: SESSION_QUERY_KEY });
      void queryClient.invalidateQueries({ queryKey: BILLING_DATA_QUERY_KEY });
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to reactivate subscription.');
    },
  });

  if (billingQuery.isPending || !billingQuery.data) return null;

  const { plan: currentPlan, subscription } = billingQuery.data;
  const upgradePlans = getUpgradePlans(currentPlan);

  // Stripe Flexible Billing uses cancelAt instead of cancelAtPeriodEnd.
  // Check both to match Better Auth's isPendingCancel logic.
  const isPendingCancel =
    (subscription?.cancelAtPeriodEnd ?? false) || !!subscription?.cancelAt;
  const periodEnd = subscription?.periodEnd
    ? new Date(subscription.periodEnd)
    : null;
  const effectiveCancelDate =
    periodEnd ??
    (subscription?.cancelAt ? new Date(subscription.cancelAt) : null);

  return (
    <div className={PAGE_LAYOUT_CLASS}>
      {isPendingCancel && effectiveCancelDate && (
        <BillingDowngradeBanner
          periodEnd={effectiveCancelDate}
          onReactivate={() => reactivateMutation.mutate()}
          isReactivating={reactivateMutation.isPending}
        />
      )}

      <BillingPlanCards
        currentPlan={currentPlan}
        upgradePlans={upgradePlans}
        nextBillingDate={periodEnd}
        annualByPlan={annualByPlan}
        onToggleInterval={(planId, annual) =>
          setAnnualByPlan((prev) => ({ ...prev, [planId]: annual }))
        }
        onManage={() => manageMutation.mutate()}
        onUpgrade={(planId, annual) =>
          upgradeMutation.mutate({ planId, annual })
        }
        isManaging={manageMutation.isPending}
        upgradingPlanId={upgradingPlanId}
      />

      <Card>
        <CardContent>
          <BillingInvoiceTable
            invoices={invoicesQuery.data ?? []}
            isLoading={invoicesQuery.isLoading}
          />
        </CardContent>
      </Card>
    </div>
  );
}
