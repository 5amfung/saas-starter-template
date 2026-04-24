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
      generatedKey: 'r_secret_123',
      keyStart: 'secret',
      keyPrefix: 'r_',
    });
  });

  it('offers exactly the two access mode options and no freeform inputs', async () => {
    const user = userEvent.setup();
    renderDialog();

    await user.click(screen.getByRole('button', { name: /generate new key/i }));

    expect(
      screen.getByRole('radio', { name: /read only/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('radio', { name: /read and write/i })
    ).toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });

  it('submits the selected access mode and invalidates the workspace detail query', async () => {
    const user = userEvent.setup();
    const { invalidateQueriesSpy } = renderDialog();

    await user.click(screen.getByRole('button', { name: /generate new key/i }));
    await user.click(screen.getByRole('radio', { name: /read and write/i }));
    await user.click(screen.getByRole('button', { name: /^save$/i }));

    await waitFor(() => {
      expect(createAdminWorkspaceApiKeyMock).toHaveBeenCalledWith({
        data: {
          workspaceId: 'ws-1',
          accessMode: 'read_write',
        },
      });
    });

    await waitFor(() => {
      expect(invalidateQueriesSpy).toHaveBeenCalledWith({
        queryKey: ADMIN_WORKSPACE_DETAIL_QUERY_KEY('ws-1'),
      });
    });
  });

  it('passes the one-time plaintext key to the success callback', async () => {
    const user = userEvent.setup();
    const onKeyCreated = vi.fn();
    renderDialog(onKeyCreated);

    await user.click(screen.getByRole('button', { name: /generate new key/i }));
    await user.click(screen.getByRole('button', { name: /^save$/i }));

    await waitFor(() => {
      expect(onKeyCreated).toHaveBeenCalledWith({
        id: 'key-1',
        key: 'r_secret_123',
        start: 'secret',
        prefix: 'r_',
      });
    });
  });
});
