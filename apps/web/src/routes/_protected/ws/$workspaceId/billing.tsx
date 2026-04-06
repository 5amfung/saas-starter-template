import { createFileRoute, notFound } from '@tanstack/react-router';
import { BillingPage } from '@/components/billing/billing-page';
import { getWorkspaceAccessCapabilities } from '@/policy/workspace-capabilities.functions';
import { useWorkspaceDetailQuery } from '@/workspace/workspace.queries';

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

function WorkspaceBillingPage() {
  const { workspaceId } = Route.useParams();
  const { data: workspace } = useWorkspaceDetailQuery(workspaceId);

  if (!workspace) return null;

  return (
    <BillingPage workspaceId={workspaceId} workspaceName={workspace.name} />
  );
}
