import { createFileRoute, getRouteApi } from '@tanstack/react-router';
import { BillingPage } from '@/components/billing/billing-page';

export const Route = createFileRoute('/_protected/ws/$workspaceId/billing')({
  component: WorkspaceBillingPage,
  staticData: { title: 'Billing' },
});

const parentRoute = getRouteApi('/_protected/ws/$workspaceId');

function WorkspaceBillingPage() {
  const { workspaceId } = Route.useParams();
  const { workspace } = parentRoute.useLoaderData();
  return (
    <BillingPage workspaceId={workspaceId} workspaceName={workspace.name} />
  );
}
