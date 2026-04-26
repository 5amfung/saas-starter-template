// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AdminDeleteWorkspaceApiKeyDialog } from '@/components/admin/admin-delete-workspace-api-key-dialog';
import { ADMIN_WORKSPACE_DETAIL_QUERY_KEY } from '@/admin/workspaces.queries';

const { deleteAdminWorkspaceApiKeyMock } = vi.hoisted(() => ({
  deleteAdminWorkspaceApiKeyMock: vi.fn(),
}));

vi.mock('@/admin/workspaces.functions', () => ({
  deleteAdminWorkspaceApiKey: deleteAdminWorkspaceApiKeyMock,
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

function renderDialog() {
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
        <AdminDeleteWorkspaceApiKeyDialog
          workspaceId="ws-1"
          apiKeyId="key-1"
          apiKeyName="Production support key"
        />
      </QueryClientProvider>
    ),
  };
}

describe('AdminDeleteWorkspaceApiKeyDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    deleteAdminWorkspaceApiKeyMock.mockResolvedValue({ success: true });
  });

  it('renders the delete trigger and opens the confirmation dialog', async () => {
    const user = userEvent.setup();
    renderDialog();

    await user.click(screen.getByRole('button', { name: /^delete$/i }));

    expect(
      await screen.findByText(/production support key/i)
    ).toBeInTheDocument();
    expect(screen.queryByText(/read api key/i)).not.toBeInTheDocument();
    expect(
      screen.getByText(/hard delete cannot be undone/i)
    ).toBeInTheDocument();
  });

  it('deletes the api key and invalidates the workspace detail query on success', async () => {
    const user = userEvent.setup();
    const { invalidateQueriesSpy } = renderDialog();

    await user.click(screen.getByRole('button', { name: /^delete$/i }));
    await screen.findByText(/hard delete cannot be undone/i);
    await user.click(
      screen.getAllByRole('button', { name: /^delete$/i }).at(-1)!
    );

    await waitFor(() => {
      expect(deleteAdminWorkspaceApiKeyMock).toHaveBeenCalledWith({
        data: {
          workspaceId: 'ws-1',
          apiKeyId: 'key-1',
        },
      });
    });

    await waitFor(() => {
      expect(invalidateQueriesSpy).toHaveBeenCalledWith({
        queryKey: ADMIN_WORKSPACE_DETAIL_QUERY_KEY('ws-1'),
      });
    });
  });
});
