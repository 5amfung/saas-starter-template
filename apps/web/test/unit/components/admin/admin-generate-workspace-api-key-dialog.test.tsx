// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AdminGenerateWorkspaceApiKeyDialog } from '@/components/admin/admin-generate-workspace-api-key-dialog';
import { ADMIN_WORKSPACE_DETAIL_QUERY_KEY } from '@/admin/workspaces.queries';

const { createAdminWorkspaceApiKeyMock } = vi.hoisted(() => ({
  createAdminWorkspaceApiKeyMock: vi.fn(),
}));

vi.mock('@/admin/workspaces.functions', () => ({
  createAdminWorkspaceApiKey: createAdminWorkspaceApiKeyMock,
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

function renderDialog(onKeyCreated = vi.fn()) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });
  const invalidateQueriesSpy = vi.spyOn(queryClient, 'invalidateQueries');

  return {
    invalidateQueriesSpy,
    ...render(
      <QueryClientProvider client={queryClient}>
        <AdminGenerateWorkspaceApiKeyDialog
          workspaceId="ws-1"
          onKeyCreated={onKeyCreated}
        />
      </QueryClientProvider>
    ),
  };
}

describe('AdminGenerateWorkspaceApiKeyDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createAdminWorkspaceApiKeyMock.mockResolvedValue({
      success: true,
      apiKeyId: 'key-1',
      generatedKey: 'sk_secret_123',
      keyStart: 'secret',
      keyPrefix: 'sk_',
    });
  });

  it('renders a required key name field without access mode options', async () => {
    const user = userEvent.setup();
    renderDialog();

    await user.click(screen.getByRole('button', { name: /generate new key/i }));

    expect(screen.getByLabelText(/key name/i)).toBeRequired();
    expect(screen.getByLabelText(/key name/i)).toHaveAttribute(
      'maxlength',
      '80'
    );
    expect(screen.queryByRole('radio', { name: /read only/i })).toBeNull();
    expect(screen.queryByRole('radio', { name: /read and write/i })).toBeNull();
  });

  it('submits the trimmed key name and invalidates the workspace detail query', async () => {
    const user = userEvent.setup();
    const { invalidateQueriesSpy } = renderDialog();

    await user.click(screen.getByRole('button', { name: /generate new key/i }));
    await user.type(
      screen.getByLabelText(/key name/i),
      '  Production support key  '
    );
    await user.click(screen.getByRole('button', { name: /^save$/i }));

    await waitFor(() => {
      expect(createAdminWorkspaceApiKeyMock).toHaveBeenCalledWith({
        data: {
          workspaceId: 'ws-1',
          name: 'Production support key',
        },
      });
    });

    await waitFor(() => {
      expect(invalidateQueriesSpy).toHaveBeenCalledWith({
        queryKey: ADMIN_WORKSPACE_DETAIL_QUERY_KEY('ws-1'),
      });
    });
  });

  it('blocks whitespace-only key names', async () => {
    const user = userEvent.setup();
    renderDialog();

    await user.click(screen.getByRole('button', { name: /generate new key/i }));
    await user.type(screen.getByLabelText(/key name/i), '   ');
    await user.click(screen.getByRole('button', { name: /^save$/i }));

    expect(createAdminWorkspaceApiKeyMock).not.toHaveBeenCalled();
    expect(screen.getByText(/key name is required/i)).toBeInTheDocument();
  });

  it('passes the one-time plaintext key to the success callback', async () => {
    const user = userEvent.setup();
    const onKeyCreated = vi.fn();
    renderDialog(onKeyCreated);

    await user.click(screen.getByRole('button', { name: /generate new key/i }));
    await user.type(
      screen.getByLabelText(/key name/i),
      'Production support key'
    );
    await user.click(screen.getByRole('button', { name: /^save$/i }));

    await waitFor(() => {
      expect(onKeyCreated).toHaveBeenCalledWith({
        id: 'key-1',
        key: 'sk_secret_123',
        start: 'secret',
        prefix: 'sk_',
      });
    });
  });
});
