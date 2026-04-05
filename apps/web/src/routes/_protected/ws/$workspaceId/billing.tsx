import { createFileRoute, getRouteApi, notFound } from '@tanstack/react-router';
import { BillingPage } from '@/components/billing/billing-page';
import { getWorkspaceAccessCapabilities } from '@/policy/workspace-capabilities.functions';

export const Route = createFileRoute('/_protected/ws/$workspaceId/billing')({
  loader: async ({ params }) => {
    const capabilities = await getWorkspaceAccessCapabilities({
      data: { workspaceId: params.workspaceId },
    });

    if (!capabilities.canViewBilling) {
      throw notFound({ routeId: '__root__' });
    }

    return capabilities;
  },
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
