import { createFileRoute } from '@tanstack/react-router';
import { BillingPage } from '@/components/billing/billing-page';

export const Route = createFileRoute('/_protected/_account/billing')({
  component: BillingPage,
  staticData: { title: 'Billing' },
});
