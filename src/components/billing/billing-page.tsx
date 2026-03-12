import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  createCheckoutSession,
  createPortalSession,
  getInvoices,
  getUserBillingData,
  reactivateSubscription,
} from '@/billing/billing.functions';
import { getUpgradePlan } from '@/billing/plans';
import type { PlanId } from '@/billing/plans';
import { SESSION_QUERY_KEY } from '@/hooks/use-session-query';
import { Card, CardContent } from '@/components/ui/card';
import { BillingDowngradeBanner } from './billing-downgrade-banner';
import { BillingInvoiceTable } from './billing-invoice-table';
import { BillingPlanCards } from './billing-plan-cards';

const PAGE_LAYOUT_CLASS =
  'mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-4 md:py-6 lg:px-6';

const INVOICES_QUERY_KEY = ['billing', 'invoices'] as const;
const BILLING_DATA_QUERY_KEY = ['billing', 'data'] as const;

export function BillingPage() {
  const queryClient = useQueryClient();
  const [isAnnual, setIsAnnual] = useState(false);

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
  const upgradePlan = getUpgradePlan(currentPlan, isAnnual);

  const cancelAtPeriodEnd = subscription?.cancelAtPeriodEnd ?? false;
  const periodEnd = subscription?.periodEnd
    ? new Date(subscription.periodEnd)
    : null;

  return (
    <div className={PAGE_LAYOUT_CLASS}>
      {cancelAtPeriodEnd && periodEnd && (
        <BillingDowngradeBanner
          periodEnd={periodEnd}
          onReactivate={() => reactivateMutation.mutate()}
          isReactivating={reactivateMutation.isPending}
        />
      )}

      <BillingPlanCards
        currentPlan={currentPlan}
        upgradePlan={upgradePlan}
        nextBillingDate={periodEnd}
        isAnnual={isAnnual}
        onToggleInterval={setIsAnnual}
        onManage={() => manageMutation.mutate()}
        onUpgrade={(id) => upgradeMutation.mutate(id)}
        isManaging={manageMutation.isPending}
        isUpgrading={upgradeMutation.isPending}
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
