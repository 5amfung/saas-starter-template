import { useQuery } from '@tanstack/react-query';
import { createFileRoute, notFound } from '@tanstack/react-router';
import { toast } from 'sonner';
import { IntegrationCard } from '@/components/integrations/integration-card';
import { IntegrationSecretFieldRow } from '@/components/integrations/integration-secret-field-row';
import {
  getWorkspaceIntegrations,
  revealWorkspaceIntegrationValue,
  updateWorkspaceIntegrationValues,
} from '@/integrations/integration-secrets.functions';
import type { IntegrationFieldKey } from '@/integrations/integration-definitions';
import type { WorkspaceIntegrationSummary } from '@/integrations/integration-secrets.types';
import { getWorkspaceCapabilities } from '@/policy/workspace-capabilities.functions';
import { useWorkspaceDetailQuery } from '@/workspace/workspace.queries';

const PAGE_LAYOUT_CLASS =
  'mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-4 md:py-6 lg:px-6';

const WORKSPACE_INTEGRATIONS_QUERY_KEY = (workspaceId: string) =>
  ['workspace', 'integrations', workspaceId] as const;

export const Route = createFileRoute(
  '/_protected/ws/$workspaceId/integrations'
)({
  loader: async ({ params }) => {
    const capabilities = await getWorkspaceCapabilities({
      data: { workspaceId: params.workspaceId },
    });

    if (!capabilities.canViewIntegrations) {
      throw notFound({ routeId: '__root__' });
    }

    return capabilities;
  },
  component: WorkspaceIntegrationsPage,
  staticData: { title: 'Integrations' },
});

function WorkspaceIntegrationsPage() {
  const { workspaceId } = Route.useParams();
  const capabilities = Route.useLoaderData();
  const { data: workspace } = useWorkspaceDetailQuery(workspaceId);
  const integrationsQuery = useQuery<Array<WorkspaceIntegrationSummary>>({
    queryKey: WORKSPACE_INTEGRATIONS_QUERY_KEY(workspaceId),
    queryFn: () =>
      getWorkspaceIntegrations({
        data: { workspaceId },
      }),
  });

  const slack = integrationsQuery.data?.find(
    (integration) => integration.integration === 'slack'
  );

  if (!workspace) {
    return null;
  }

  const handleReveal = async (fieldKey: IntegrationFieldKey) => {
    const result = await revealWorkspaceIntegrationValue({
      data: {
        workspaceId,
        integration: 'slack',
        key: fieldKey,
      },
    });

    return result.value;
  };

  const handleSave = async (fieldKey: IntegrationFieldKey, value: string) => {
    await updateWorkspaceIntegrationValues({
      data: {
        workspaceId,
        integration: 'slack',
        values: [{ key: fieldKey, value }],
      },
    });

    await integrationsQuery.refetch();
    const savedField = slack?.fields.find((field) => field.key === fieldKey);
    toast.success(`${savedField?.label ?? 'Integration value'} saved.`);
  };

  return (
    <div className={PAGE_LAYOUT_CLASS} data-testid="integrations-page-layout">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Integrations</h1>
        <p className="text-sm text-muted-foreground">
          Connect external services for {workspace.name}.
        </p>
      </div>

      {slack ? (
        <IntegrationCard
          integration="slack"
          title="Slack"
          description="Store the Slack app credentials used to connect this workspace."
        >
          {slack.fields.map((field) => (
            <IntegrationSecretFieldRow
              key={field.key}
              canManage={capabilities.canManageIntegrations}
              fieldKey={field.key}
              hasValue={field.hasValue}
              integration="slack"
              label={field.label}
              maskedValue={field.maskedValue}
              onReveal={handleReveal}
              onSave={handleSave}
            />
          ))}
        </IntegrationCard>
      ) : null}
    </div>
  );
}
