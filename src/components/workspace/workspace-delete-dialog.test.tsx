// @vitest-environment jsdom
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@/test/render';
import { WorkspaceDeleteDialog } from '@/components/workspace/workspace-delete-dialog';

const { organizationDeleteMock, organizationSetActiveMock, navigateMock } =
  vi.hoisted(() => ({
    organizationDeleteMock: vi.fn(),
    organizationSetActiveMock: vi.fn(),
    navigateMock: vi.fn(),
  }));

vi.mock('@/auth/auth-client', () => ({
  authClient: {
    organization: {
      delete: organizationDeleteMock,
      setActive: organizationSetActiveMock,
    },
  },
}));

vi.mock('@tanstack/react-router', async () => {
  const actual = await import('@tanstack/react-router');
  return { ...actual, useNavigate: () => navigateMock };
});

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

const defaultProps = {
  workspaceId: 'ws-123',
  workspaceName: 'My Workspace',
  isDisabled: false,
  getNextWorkspaceIdAfterDelete: vi.fn().mockResolvedValue('ws-456'),
};

describe('WorkspaceDeleteDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    defaultProps.getNextWorkspaceIdAfterDelete = vi
      .fn()
      .mockResolvedValue('ws-456');
  });

  it('renders delete button', () => {
    renderWithProviders(<WorkspaceDeleteDialog {...defaultProps} />);

    expect(
      screen.getByRole('button', { name: /delete workspace/i }),
    ).toBeInTheDocument();
  });

  it('disables trigger button when isDisabled is true', () => {
    renderWithProviders(
      <WorkspaceDeleteDialog {...defaultProps} isDisabled={true} />,
    );

    expect(
      screen.getByRole('button', { name: /delete workspace/i }),
    ).toBeDisabled();
  });

  it('opens dialog and shows workspace name', async () => {
    const user = userEvent.setup();
    renderWithProviders(<WorkspaceDeleteDialog {...defaultProps} />);

    await user.click(screen.getByRole('button', { name: /delete workspace/i }));

    // Workspace name appears in the description.
    expect(screen.getByText(/my workspace/i)).toBeInTheDocument();
    // Dialog title is rendered as a heading.
    expect(
      screen.getByRole('heading', { name: /delete workspace/i }),
    ).toBeInTheDocument();
  });

  it('keeps confirm button disabled until DELETE is typed', async () => {
    const user = userEvent.setup();
    renderWithProviders(<WorkspaceDeleteDialog {...defaultProps} />);

    await user.click(screen.getByRole('button', { name: /delete workspace/i }));

    const confirmButton = screen.getByRole('button', {
      name: /confirm delete/i,
    });
    expect(confirmButton).toBeDisabled();

    await user.type(screen.getByPlaceholderText('DELETE'), 'DELET');
    expect(confirmButton).toBeDisabled();

    await user.type(screen.getByPlaceholderText('DELETE'), 'E');
    expect(confirmButton).not.toBeDisabled();
  });

  it('deletes workspace and navigates on success', async () => {
    const { toast } = await import('sonner');
    const user = userEvent.setup();

    organizationDeleteMock.mockResolvedValue({ error: null });
    organizationSetActiveMock.mockResolvedValue({ error: null });

    renderWithProviders(<WorkspaceDeleteDialog {...defaultProps} />);

    await user.click(screen.getByRole('button', { name: /delete workspace/i }));
    await user.type(screen.getByPlaceholderText('DELETE'), 'DELETE');
    await user.click(screen.getByRole('button', { name: /confirm delete/i }));

    await waitFor(() => {
      expect(organizationDeleteMock).toHaveBeenCalledWith({
        organizationId: 'ws-123',
      });
    });

    await waitFor(() => {
      expect(defaultProps.getNextWorkspaceIdAfterDelete).toHaveBeenCalledTimes(
        1,
      );
    });

    await waitFor(() => {
      expect(organizationSetActiveMock).toHaveBeenCalledWith({
        organizationId: 'ws-456',
      });
    });

    await waitFor(() => {
      expect(navigateMock).toHaveBeenCalledWith({
        to: '/ws/$workspaceId/overview',
        params: { workspaceId: 'ws-456' },
      });
    });

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith(
        'Workspace deleted successfully.',
      );
    });
  });

  it('shows error toast on deletion failure', async () => {
    const { toast } = await import('sonner');
    const user = userEvent.setup();

    organizationDeleteMock.mockResolvedValue({
      error: { message: 'Permission denied' },
    });

    renderWithProviders(<WorkspaceDeleteDialog {...defaultProps} />);

    await user.click(screen.getByRole('button', { name: /delete workspace/i }));
    await user.type(screen.getByPlaceholderText('DELETE'), 'DELETE');
    await user.click(screen.getByRole('button', { name: /confirm delete/i }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Permission denied');
    });

    // Dialog stays in DOM on error.
    expect(
      screen.getByRole('button', { name: /confirm delete/i }),
    ).toBeInTheDocument();
  });
});
