import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as Sentry from '@sentry/tanstackstart-react';
import { toast } from 'sonner';
import { getFreePlan, getPlanById } from '@workspace/billing';
import { Card, CardContent } from '@workspace/ui/components/card';
import { SESSION_QUERY_KEY } from '@workspace/components/hooks';
import { OPERATIONS, buildWorkflowAttributes } from '@workspace/logging/client';
import { BillingDowngradeBanner } from './billing-downgrade-banner';
import { BillingDowngradeConfirmDialog } from './billing-downgrade-confirm-dialog';
import { BillingInvoiceTable } from './billing-invoice-table';
import { BillingManagePlanDialog } from './billing-manage-plan-dialog';
import { BillingPlanCards } from './billing-plan-cards';
import type { PlanDefinition, PlanId } from '@workspace/billing';
import {
  cancelWorkspaceSubscription,
  createWorkspaceCheckoutSession,
  createWorkspacePortalSession,
  downgradeWorkspaceSubscription,
  getWorkspaceInvoices,
  reactivateWorkspaceSubscription,
} from '@/billing/billing.functions';
import {
  BILLING_DATA_QUERY_KEY,
  useBillingDataQuery,
} from '@/billing/use-billing-data-query';

const PAGE_LAYOUT_CLASS =
  'mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-4 md:py-6 lg:px-6';

type BillingPageProps = { workspaceId: string; workspaceName: string };
type BillingWorkflowOutcome = 'attempt' | 'success' | 'failure';

const BILLING_ROUTE = '/ws/$workspaceId/billing';

function buildBillingWorkflowAttributes(
  operation: (typeof OPERATIONS)[keyof typeof OPERATIONS],
  attributes: {
    workspaceId: string;
    planId?: PlanId;
    result: BillingWorkflowOutcome;
  }
) {
  return buildWorkflowAttributes(operation, {
    route: BILLING_ROUTE,
    ...attributes,
  });
}

function startBillingWorkflowSpan<T>(
  operation: (typeof OPERATIONS)[keyof typeof OPERATIONS],
  name: string,
  attributes: {
    workspaceId: string;
    planId?: PlanId;
    result: BillingWorkflowOutcome;
  },
  callback: () => Promise<T>
) {
  return Sentry.startSpan(
    {
      op: operation,
      name,
      attributes: buildBillingWorkflowAttributes(operation, attributes),
    },
    callback
  );
}

export function BillingPage({ workspaceId, workspaceName }: BillingPageProps) {
  const queryClient = useQueryClient();
  const [upgradingPlanId, setUpgradingPlanId] = useState<PlanId | null>(null);
  const [managePlanOpen, setManagePlanOpen] = useState(false);
  const [downgradeTarget, setDowngradeTarget] = useState<PlanDefinition | null>(
    null
  );
  const [downgradeAnnual, setDowngradeAnnual] = useState(false);

  const INVOICES_QUERY_KEY = ['billing', 'invoices', workspaceId] as const;

  const billingQuery = useBillingDataQuery(workspaceId);

  const invoicesQuery = useQuery({
    queryKey: INVOICES_QUERY_KEY,
    queryFn: () => getWorkspaceInvoices({ data: { workspaceId } }),
  });

  const manageMutation = useMutation({
    mutationFn: () =>
      startBillingWorkflowSpan(
        OPERATIONS.BILLING_PORTAL_CREATE_SESSION,
        'Open billing portal',
        {
          workspaceId,
          result: 'attempt',
        },
        () => createWorkspacePortalSession({ data: { workspaceId } })
      ),
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
      startBillingWorkflowSpan(
        OPERATIONS.BILLING_CHECKOUT_CREATE_SESSION,
        'Create billing checkout session',
        {
          workspaceId,
          planId,
          result: 'attempt',
        },
        () =>
          createWorkspaceCheckoutSession({
            data: { workspaceId, planId, annual, subscriptionId },
          })
      ),
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
      startBillingWorkflowSpan(
        OPERATIONS.BILLING_SUBSCRIPTION_REACTIVATE,
        'Reactivate billing subscription',
        {
          workspaceId,
          result: 'attempt',
        },
        () => reactivateWorkspaceSubscription({ data: { workspaceId } })
      ),
    onSuccess: () => {
      toast.success('Subscription reactivated.');
      void queryClient.invalidateQueries({ queryKey: SESSION_QUERY_KEY });
      void queryClient.invalidateQueries({
        queryKey: BILLING_DATA_QUERY_KEY(workspaceId),
      });
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to reactivate subscription.');
    },
  });

  /** Optimistically patch the cached billing data so the UI reflects the
   * pending cancel/downgrade immediately, without waiting for Stripe's
   * webhook to propagate to the local database. */
  type BillingData = NonNullable<typeof billingQuery.data>;
  const patchBillingCache = (patch: {
    scheduledTargetPlanId?: PlanId | null;
    subscription?: Partial<NonNullable<BillingData['subscription']>>;
    lifecycle?: Partial<BillingData['productPolicy']['lifecycle']>;
  }) => {
    queryClient.setQueryData<BillingData>(
      BILLING_DATA_QUERY_KEY(workspaceId),
      (prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          ...(patch.scheduledTargetPlanId !== undefined && {
            scheduledTargetPlanId: patch.scheduledTargetPlanId,
          }),
          subscription: prev.subscription
            ? { ...prev.subscription, ...patch.subscription }
            : prev.subscription,
          productPolicy: {
            ...prev.productPolicy,
            lifecycle: {
              ...prev.productPolicy.lifecycle,
              ...patch.lifecycle,
            },
          },
        };
      }
    );
  };

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
      startBillingWorkflowSpan(
        OPERATIONS.BILLING_SUBSCRIPTION_DOWNGRADE,
        'Schedule billing downgrade',
        {
          workspaceId,
          planId,
          result: 'attempt',
        },
        () =>
          downgradeWorkspaceSubscription({
            data: { workspaceId, planId, annual, subscriptionId },
          })
      ),
    onSuccess: (_result, { planId }) => {
      toast.success('Downgrade scheduled.');
      setDowngradeTarget(null);
      setManagePlanOpen(false);
      patchBillingCache({
        scheduledTargetPlanId: planId,
        subscription: { stripeScheduleId: 'pending' },
        lifecycle: {
          isPendingCancel: false,
          isPendingDowngrade: true,
          effectivePeriodEnd:
            subscription?.periodEnd ??
            billingQuery.data?.productPolicy.lifecycle.effectivePeriodEnd ??
            null,
          scheduledTargetPlanId: planId,
        },
      });
      void queryClient.invalidateQueries({ queryKey: SESSION_QUERY_KEY });
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to schedule downgrade.');
    },
  });

  const cancelMutation = useMutation({
    mutationFn: () =>
      startBillingWorkflowSpan(
        OPERATIONS.BILLING_SUBSCRIPTION_CANCEL,
        'Cancel billing subscription',
        {
          workspaceId,
          result: 'attempt',
        },
        () => cancelWorkspaceSubscription({ data: { workspaceId } })
      ),
    onSuccess: () => {
      toast.success('Subscription will cancel at period end.');
      setDowngradeTarget(null);
      setManagePlanOpen(false);
      patchBillingCache({
        scheduledTargetPlanId: null,
        subscription: { cancelAtPeriodEnd: true },
        lifecycle: {
          isPendingCancel: true,
          isPendingDowngrade: false,
          effectivePeriodEnd:
            subscription?.periodEnd ??
            billingQuery.data?.productPolicy.lifecycle.effectivePeriodEnd ??
            null,
          scheduledTargetPlanId: null,
        },
      });
      void queryClient.invalidateQueries({ queryKey: SESSION_QUERY_KEY });
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to cancel subscription.');
    },
  });

  if (billingQuery.isPending || !billingQuery.data) return null;

  const { plan: currentPlan, entitlements, subscription } = billingQuery.data;
  const { productPolicy } = billingQuery.data;
  const periodEnd = subscription?.periodEnd
    ? new Date(subscription.periodEnd)
    : null;
  const effectiveCancelDate = productPolicy.lifecycle.effectivePeriodEnd
    ? new Date(productPolicy.lifecycle.effectivePeriodEnd)
    : null;

  return (
    <div className={PAGE_LAYOUT_CLASS}>
      {(productPolicy.lifecycle.isPendingCancel ||
        productPolicy.lifecycle.isPendingDowngrade) &&
        effectiveCancelDate && (
          <BillingDowngradeBanner
            targetPlanName={
              productPolicy.lifecycle.scheduledTargetPlanId
                ? (getPlanById(productPolicy.lifecycle.scheduledTargetPlanId)
                    ?.name ?? getFreePlan().name)
                : getFreePlan().name
            }
            periodEnd={effectiveCancelDate}
            onReactivate={() => reactivateMutation.mutate()}
            isReactivating={reactivateMutation.isPending}
          />
        )}

      <BillingPlanCards
        currentPlan={currentPlan}
        currentEntitlements={entitlements}
        productPolicy={productPolicy}
        nextBillingDate={periodEnd}
        onManagePlan={() => setManagePlanOpen(true)}
        onBillingPortal={() => manageMutation.mutate()}
        isBillingPortalLoading={manageMutation.isPending}
        workspaceName={workspaceName}
      />

      <BillingManagePlanDialog
        open={managePlanOpen}
        onOpenChange={setManagePlanOpen}
        currentPlan={currentPlan}
        productPolicy={productPolicy}
        isPendingCancel={productPolicy.lifecycle.isPendingCancel}
        isPendingDowngrade={productPolicy.lifecycle.isPendingDowngrade}
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
        workspaceName={workspaceName}
      />

      {downgradeTarget && (
        <BillingDowngradeConfirmDialog
          open={!!downgradeTarget}
          onOpenChange={(open) => {
            if (!open) setDowngradeTarget(null);
          }}
          currentPlan={currentPlan}
          targetPlan={downgradeTarget}
          targetAnnual={downgradeAnnual}
          periodEnd={periodEnd}
          currentMemberCount={billingQuery.data.memberCount}
          onConfirm={() => {
            if (
              productPolicy.planChanges[downgradeTarget.id].action === 'cancel'
            ) {
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
