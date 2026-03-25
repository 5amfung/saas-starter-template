import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  getFreePlan,
  getPlanById,
  getUpgradePlans,
} from '@workspace/auth/plans';
import { Card, CardContent } from '@workspace/ui/components/card';
import { BillingDowngradeBanner } from './billing-downgrade-banner';
import { BillingDowngradeConfirmDialog } from './billing-downgrade-confirm-dialog';
import { BillingInvoiceTable } from './billing-invoice-table';
import { BillingManagePlanDialog } from './billing-manage-plan-dialog';
import { BillingPlanCards } from './billing-plan-cards';
import type { Plan, PlanId } from '@workspace/auth/plans';
import { SESSION_QUERY_KEY } from '@/hooks/use-session-query';
import {
  cancelWorkspaceSubscription,
  createWorkspaceCheckoutSession,
  createWorkspacePortalSession,
  downgradeWorkspaceSubscription,
  getWorkspaceBillingData,
  getWorkspaceInvoices,
  reactivateWorkspaceSubscription,
} from '@/billing/billing.functions';

const PAGE_LAYOUT_CLASS =
  'mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-4 md:py-6 lg:px-6';

type BillingPageProps = { workspaceId: string };

export function BillingPage({ workspaceId }: BillingPageProps) {
  const queryClient = useQueryClient();
  const [annualByPlan, setAnnualByPlan] = useState<
    Partial<Record<PlanId, boolean>>
  >({});
  const [upgradingPlanId, setUpgradingPlanId] = useState<PlanId | null>(null);
  const [managePlanOpen, setManagePlanOpen] = useState(false);
  const [downgradeTarget, setDowngradeTarget] = useState<Plan | null>(null);
  const [downgradeAnnual, setDowngradeAnnual] = useState(false);

  const INVOICES_QUERY_KEY = ['billing', 'invoices', workspaceId] as const;
  const BILLING_DATA_QUERY_KEY = ['billing', 'data', workspaceId] as const;

  const billingQuery = useQuery({
    queryKey: BILLING_DATA_QUERY_KEY,
    queryFn: () => getWorkspaceBillingData({ data: { workspaceId } }),
  });

  const invoicesQuery = useQuery({
    queryKey: INVOICES_QUERY_KEY,
    queryFn: () => getWorkspaceInvoices({ data: { workspaceId } }),
  });

  const manageMutation = useMutation({
    mutationFn: () => createWorkspacePortalSession({ data: { workspaceId } }),
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
    mutationFn: ({
      planId,
      annual,
      subscriptionId,
    }: {
      planId: PlanId;
      annual: boolean;
      subscriptionId?: string;
    }) =>
      createWorkspaceCheckoutSession({
        data: { workspaceId, planId, annual, subscriptionId },
      }),
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
    mutationFn: () =>
      reactivateWorkspaceSubscription({ data: { workspaceId } }),
    onSuccess: () => {
      toast.success('Subscription reactivated.');
      void queryClient.invalidateQueries({ queryKey: SESSION_QUERY_KEY });
      void queryClient.invalidateQueries({ queryKey: BILLING_DATA_QUERY_KEY });
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to reactivate subscription.');
    },
  });

  const downgradeMutation = useMutation({
    mutationFn: ({
      planId,
      annual,
      subscriptionId,
    }: {
      planId: PlanId;
      annual: boolean;
      subscriptionId: string;
    }) =>
      downgradeWorkspaceSubscription({
        data: { workspaceId, planId, annual, subscriptionId },
      }),
    onSuccess: () => {
      toast.success('Downgrade scheduled.');
      setDowngradeTarget(null);
      setManagePlanOpen(false);
      void queryClient.invalidateQueries({ queryKey: SESSION_QUERY_KEY });
      void queryClient.invalidateQueries({ queryKey: BILLING_DATA_QUERY_KEY });
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to schedule downgrade.');
    },
  });

  const cancelMutation = useMutation({
    mutationFn: () => cancelWorkspaceSubscription({ data: { workspaceId } }),
    onSuccess: () => {
      toast.success('Subscription will cancel at period end.');
      setDowngradeTarget(null);
      setManagePlanOpen(false);
      void queryClient.invalidateQueries({ queryKey: SESSION_QUERY_KEY });
      void queryClient.invalidateQueries({ queryKey: BILLING_DATA_QUERY_KEY });
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to cancel subscription.');
    },
  });

  if (billingQuery.isPending || !billingQuery.data) return null;

  const { plan: currentPlan, subscription } = billingQuery.data;
  const upgradePlans = getUpgradePlans(currentPlan);

  // Stripe Flexible Billing uses cancelAt instead of cancelAtPeriodEnd.
  // Check both to match Better Auth's isPendingCancel logic.
  const isPendingCancel =
    (subscription?.cancelAtPeriodEnd ?? false) ||
    !!subscription?.cancelAt ||
    !!subscription?.stripeScheduleId;
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
          targetPlanName={
            billingQuery.data.scheduledTargetPlanId
              ? (getPlanById(billingQuery.data.scheduledTargetPlanId)?.name ??
                getFreePlan().name)
              : getFreePlan().name
          }
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
        onManagePlan={() => setManagePlanOpen(true)}
        onUpgrade={(planId, annual) =>
          upgradeMutation.mutate({
            planId,
            annual,
            subscriptionId: subscription?.stripeSubscriptionId ?? undefined,
          })
        }
        onBillingPortal={() => manageMutation.mutate()}
        isManaging={manageMutation.isPending}
        isBillingPortalLoading={manageMutation.isPending}
        upgradingPlanId={upgradingPlanId}
      />

      <BillingManagePlanDialog
        open={managePlanOpen}
        onOpenChange={setManagePlanOpen}
        currentPlan={currentPlan}
        isPendingCancel={isPendingCancel}
        onUpgrade={(planId, annual) => {
          setManagePlanOpen(false);
          upgradeMutation.mutate({
            planId,
            annual,
            subscriptionId: subscription?.stripeSubscriptionId ?? undefined,
          });
        }}
        onDowngrade={(targetPlan, annual) => {
          setDowngradeTarget(targetPlan);
          setDowngradeAnnual(annual);
        }}
        isProcessing={upgradingPlanId !== null}
      />

      {downgradeTarget && (
        <BillingDowngradeConfirmDialog
          open={!!downgradeTarget}
          onOpenChange={(open) => {
            if (!open) setDowngradeTarget(null);
          }}
          currentPlan={currentPlan}
          targetPlan={downgradeTarget}
          periodEnd={periodEnd}
          currentMemberCount={billingQuery.data.memberCount}
          onConfirm={() => {
            if (downgradeTarget.pricing === null) {
              cancelMutation.mutate();
            } else {
              downgradeMutation.mutate({
                planId: downgradeTarget.id,
                annual: downgradeAnnual,
                subscriptionId: subscription!.stripeSubscriptionId!,
              });
            }
          }}
          isProcessing={downgradeMutation.isPending || cancelMutation.isPending}
        />
      )}

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
