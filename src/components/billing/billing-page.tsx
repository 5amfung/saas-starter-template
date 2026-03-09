import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  createCheckoutSession,
  createPortalSession,
  getInvoices,
  reactivateSubscription,
} from '@/billing/billing.functions';
import {
  FREE_PLAN_ID,
  PLANS,
  PLAN_GROUP,
  getFreePlan,
  getPlanById,
} from '@/billing/plans';
import type { Plan } from '@/billing/plans';
import { SESSION_QUERY_KEY, useSessionQuery } from '@/hooks/use-session-query';
import { BillingDowngradeBanner } from './billing-downgrade-banner';
import { BillingInvoiceTable } from './billing-invoice-table';
import { BillingPlanCards } from './billing-plan-cards';

const PAGE_LAYOUT_CLASS =
  'mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-4 md:py-6 lg:px-6';

const INVOICES_QUERY_KEY = ['billing', 'invoices'] as const;

/** Returns the next upgrade plan for a given plan (next tier up), or null. */
function getUpgradePlan(currentPlan: Plan, annual: boolean): Plan | null {
  const sorted = PLANS.filter((p) => p.tier > currentPlan.tier).sort(
    (a, b) => a.tier - b.tier,
  );
  if (sorted.length === 0) return null;

  // Non-null assertion is safe: we checked sorted.length above.
   
  const nextTierPlan = sorted[0];
  const nextGroup = PLAN_GROUP[nextTierPlan.id];
  // Find the monthly or annual variant of the next tier.
  return (
    PLANS.find(
      (p) =>
        PLAN_GROUP[p.id] === nextGroup &&
        p.interval === (annual ? 'year' : 'month'),
    ) ?? nextTierPlan
  );
}

export function BillingPage() {
  const queryClient = useQueryClient();
  const { data: session, isPending } = useSessionQuery();
  const [isAnnual, setIsAnnual] = useState(false);

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
    mutationFn: ({ planId, annual }: { planId: string; annual: boolean }) =>
      createCheckoutSession({ data: { planId, annual } }),
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
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to reactivate subscription.');
    },
  });

  if (isPending || !session) return null;

  // The Stripe plugin extends the session user with subscription data.
  // Cast as unknown first since the type inference doesn't capture this automatically.
  const userWithSub = session.user as unknown as {
    subscription?: {
      plan?: string;
      status?: string;
      periodEnd?: Date | string;
      cancelAtPeriodEnd?: boolean;
    };
  };
  const subscription = userWithSub.subscription;
  const planId = subscription?.plan ?? FREE_PLAN_ID;
  const currentPlan = getPlanById(planId as never) ?? getFreePlan();
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
        onUpgrade={(id, annual) =>
          upgradeMutation.mutate({ planId: id, annual })
        }
        isManaging={manageMutation.isPending}
        isUpgrading={upgradeMutation.isPending}
      />

      <BillingInvoiceTable
        invoices={invoicesQuery.data ?? []}
        isLoading={invoicesQuery.isLoading}
      />
    </div>
  );
}
