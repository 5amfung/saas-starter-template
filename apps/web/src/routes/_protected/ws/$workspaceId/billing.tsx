import { createFileRoute } from '@tanstack/react-router';
import { BillingPage } from '@/components/billing/billing-page';

export const Route = createFileRoute('/_protected/ws/$workspaceId/billing')({
  component: WorkspaceBillingPage,
  staticData: { title: 'Billing' },
});

function WorkspaceBillingPage() {
  const { workspaceId } = Route.useParams();
  return <BillingPage workspaceId={workspaceId} />;
}
