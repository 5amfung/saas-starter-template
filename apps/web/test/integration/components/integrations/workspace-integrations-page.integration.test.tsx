// @vitest-environment jsdom
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@workspace/test-utils';
import { Route } from '@/routes/_protected/ws/$workspaceId/integrations';

const {
  getWorkspaceIntegrationsMock,
  updateWorkspaceIntegrationValuesMock,
  useWorkspaceDetailQueryMock,
  mockToastSuccess,
  mockToastError,
} = vi.hoisted(() => ({
  getWorkspaceIntegrationsMock: vi.fn(),
  updateWorkspaceIntegrationValuesMock: vi.fn(),
  useWorkspaceDetailQueryMock: vi.fn(),
  mockToastSuccess: vi.fn(),
  mockToastError: vi.fn(),
}));

vi.mock('@/integrations/integration-secrets.functions', () => ({
  getWorkspaceIntegrations: getWorkspaceIntegrationsMock,
  updateWorkspaceIntegrationValues: updateWorkspaceIntegrationValuesMock,
}));

vi.mock('@/workspace/workspace.queries', () => ({
  useWorkspaceDetailQuery: useWorkspaceDetailQueryMock,
}));

vi.mock('sonner', () => ({
  toast: { success: mockToastSuccess, error: mockToastError },
}));

describe('WorkspaceIntegrationsPage integration', () => {
  const PageComponent = Route.options.component!;
  const useParamsMock = vi.spyOn(Route, 'useParams');
  const useLoaderDataMock = vi.spyOn(Route, 'useLoaderData');

  beforeEach(() => {
    vi.clearAllMocks();

    useParamsMock.mockReturnValue({ workspaceId: 'ws-1' } as never);
    useLoaderDataMock.mockReturnValue({
      canViewIntegrations: true,
      canManageIntegrations: true,
    } as never);
    useWorkspaceDetailQueryMock.mockReturnValue({
      data: { id: 'ws-1', name: 'Acme Workspace' },
    });
    getWorkspaceIntegrationsMock.mockResolvedValue([
      {
        integration: 'slack',
        label: 'Slack',
        fields: [
          {
            key: 'clientId',
            label: 'Client ID',
            hasValue: true,
            maskedValue: 'abc123******',
            value: 'abc123secret',
          },
          {
            key: 'clientSecret',
            label: 'Client Secret',
            hasValue: true,
            maskedValue: 'def456******',
            value: 'def456secret',
          },
        ],
      },
    ]);
    updateWorkspaceIntegrationValuesMock.mockResolvedValue(undefined);
  });

  it('renders the Slack card in a centered settings-style layout', async () => {
    renderWithProviders(<PageComponent />);

    expect(
      await screen.findByRole('heading', { name: 'Integrations' })
    ).toBeInTheDocument();
    expect(
      screen.getByText('Connect external services for Acme Workspace.')
    ).toBeInTheDocument();
    expect(
      await screen.findByRole('heading', { name: 'Slack' })
    ).toBeInTheDocument();
    expect(screen.getByTestId('integrations-page-layout')).toHaveClass(
      'mx-auto'
    );
    expect(screen.getByTestId('integrations-page-layout')).toHaveClass(
      'max-w-2xl'
    );
    expect(screen.getByLabelText('Client ID')).toHaveValue('abc123******');
    expect(screen.getByLabelText('Client Secret')).toHaveValue('def456******');
    expect(
      screen.getByRole('button', { name: 'Save Client ID' })
    ).toBeDisabled();
    expect(
      screen.getByRole('button', { name: 'Cancel Client ID' })
    ).toBeDisabled();
  });

  it('toggles a saved value locally between masked and revealed states', async () => {
    const user = userEvent.setup();
    renderWithProviders(<PageComponent />);

    await screen.findByRole('heading', { name: 'Slack' });
    await user.click(screen.getByRole('button', { name: 'Reveal Client ID' }));
    expect(screen.getByLabelText('Client ID')).toHaveValue('abc123secret');
    expect(
      screen.getByRole('button', { name: 'Hide Client ID' })
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Hide Client ID' }));
    expect(screen.getByLabelText('Client ID')).toHaveValue('abc123******');
    expect(
      screen.getByRole('button', { name: 'Reveal Client ID' })
    ).toBeInTheDocument();
  });

  it('reveals instantly without a loading state or reveal request', async () => {
    const user = userEvent.setup();
    renderWithProviders(<PageComponent />);

    const clientIdInput = await screen.findByLabelText('Client ID');
    await user.click(screen.getByRole('button', { name: 'Reveal Client ID' }));
    expect(clientIdInput).toHaveValue('abc123secret');
    expect(
      screen.queryByTestId('integration-field-loading')
    ).not.toBeInTheDocument();
  });

  it('enables save only after a field changes and cancel restores the saved masked state', async () => {
    const user = userEvent.setup();
    renderWithProviders(<PageComponent />);

    const clientIdInput = await screen.findByLabelText('Client ID');
    const saveButton = screen.getByRole('button', { name: 'Save Client ID' });
    const cancelButton = screen.getByRole('button', {
      name: 'Cancel Client ID',
    });

    expect(saveButton).toBeDisabled();
    expect(cancelButton).toBeDisabled();

    await user.clear(clientIdInput);
    await user.type(clientIdInput, 'updated-client-id');

    await waitFor(() => {
      expect(saveButton).toBeEnabled();
      expect(cancelButton).toBeEnabled();
    });

    await user.click(cancelButton);

    await waitFor(() => {
      expect(clientIdInput).toHaveValue('abc123******');
    });
    expect(saveButton).toBeDisabled();
    expect(cancelButton).toBeDisabled();
    expect(updateWorkspaceIntegrationValuesMock).not.toHaveBeenCalled();
  });

  it('saves a single field row independently and re-masks the saved value', async () => {
    const user = userEvent.setup();
    getWorkspaceIntegrationsMock
      .mockResolvedValueOnce([
        {
          integration: 'slack',
          label: 'Slack',
          fields: [
            {
              key: 'clientId',
              label: 'Client ID',
              hasValue: true,
              maskedValue: 'abc123******',
              value: 'abc123secret',
            },
            {
              key: 'clientSecret',
              label: 'Client Secret',
              hasValue: true,
              maskedValue: 'def456******',
              value: 'def456secret',
            },
          ],
        },
      ])
      .mockResolvedValueOnce([
        {
          integration: 'slack',
          label: 'Slack',
          fields: [
            {
              key: 'clientId',
              label: 'Client ID',
              hasValue: true,
              maskedValue: 'update***********',
              value: 'updated-client-id',
            },
            {
              key: 'clientSecret',
              label: 'Client Secret',
              hasValue: true,
              maskedValue: 'def456******',
              value: 'def456secret',
            },
          ],
        },
      ]);

    renderWithProviders(<PageComponent />);

    const clientIdInput = await screen.findByLabelText('Client ID');
    await user.clear(clientIdInput);
    await user.type(clientIdInput, 'updated-client-id');
    await user.click(screen.getByRole('button', { name: 'Save Client ID' }));

    await waitFor(() => {
      expect(updateWorkspaceIntegrationValuesMock).toHaveBeenCalledWith({
        data: {
          workspaceId: 'ws-1',
          integration: 'slack',
          values: [{ key: 'clientId', value: 'updated-client-id' }],
        },
      });
    });

    await waitFor(() => {
      expect(screen.getByLabelText('Client ID')).toHaveValue(
        'update***********'
      );
    });
    expect(
      screen.getByRole('button', { name: 'Save Client ID' })
    ).toBeDisabled();
    expect(mockToastSuccess).toHaveBeenCalledWith('Client ID saved.');
  });

  it('shows an error toast and preserves the draft when save fails', async () => {
    const user = userEvent.setup();
    updateWorkspaceIntegrationValuesMock.mockRejectedValue(
      new Error('Save failed.')
    );

    renderWithProviders(<PageComponent />);

    const clientIdInput = await screen.findByLabelText('Client ID');
    await user.clear(clientIdInput);
    await user.type(clientIdInput, 'updated-client-id');
    await user.click(screen.getByRole('button', { name: 'Save Client ID' }));

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith('Save failed.');
    });

    expect(clientIdInput).toHaveValue('updated-client-id');
    expect(
      screen.getByRole('button', { name: 'Save Client ID' })
    ).toBeEnabled();
    expect(
      screen.getByRole('button', { name: 'Cancel Client ID' })
    ).toBeEnabled();
  });

  it('respects canManageIntegrations by disabling editing and reveal actions', async () => {
    useLoaderDataMock.mockReturnValue({
      canViewIntegrations: true,
      canManageIntegrations: false,
    } as never);

    renderWithProviders(<PageComponent />);

    expect(await screen.findByLabelText('Client ID')).toBeDisabled();
    expect(
      screen.getByRole('button', { name: 'Reveal Client ID' })
    ).toBeDisabled();
    expect(
      screen.getByRole('button', { name: 'Save Client ID' })
    ).toBeDisabled();
    expect(
      screen.getByRole('button', { name: 'Cancel Client ID' })
    ).toBeDisabled();
  });
});
