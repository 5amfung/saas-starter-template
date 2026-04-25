// @vitest-environment jsdom
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@workspace/test-utils';
import type * as LoggingClient from '@/observability/client';
import { OPERATIONS } from '@/observability/client';
import { WorkspaceDeleteDialog } from '@/components/workspace/workspace-delete-dialog';

const { setActiveMock, assignMock } = vi.hoisted(() => ({
  setActiveMock: vi.fn(),
  assignMock: vi.fn(),
}));

const { startSpanMock, loggerInfoMock, loggerErrorMock } = vi.hoisted(() => ({
  startSpanMock: vi.fn((_, callback: () => unknown) => callback()),
  loggerInfoMock: vi.fn(),
  loggerErrorMock: vi.fn(),
}));

vi.mock('@/auth/client/auth-client', () => ({
  authClient: {
    organization: {
      setActive: setActiveMock,
    },
  },
}));

vi.mock('@/observability/client', async (importActual) => {
  const actual = await importActual<typeof LoggingClient>();
  return {
    ...actual,
    startWorkflowSpan: startSpanMock,
    workflowLogger: {
      info: loggerInfoMock,
      error: loggerErrorMock,
    },
  };
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
  onDelete: vi.fn().mockResolvedValue('ws-456'),
};

describe('WorkspaceDeleteDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    defaultProps.onDelete = vi.fn().mockResolvedValue('ws-456');
    setActiveMock.mockResolvedValue({ error: null });
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: {
        ...window.location,
        assign: assignMock,
      },
    });
  });

  it('renders delete button', () => {
    renderWithProviders(<WorkspaceDeleteDialog {...defaultProps} />);

    expect(
      screen.getByRole('button', { name: /delete workspace/i })
    ).toBeInTheDocument();
  });

  it('disables trigger button when isDisabled is true', () => {
    renderWithProviders(
      <WorkspaceDeleteDialog {...defaultProps} isDisabled={true} />
    );

    expect(
      screen.getByRole('button', { name: /delete workspace/i })
    ).toBeDisabled();
  });

  it('opens dialog and shows workspace name', async () => {
    const user = userEvent.setup();
    renderWithProviders(<WorkspaceDeleteDialog {...defaultProps} />);

    await user.click(screen.getByRole('button', { name: /delete workspace/i }));

    expect(screen.getByText(/my workspace/i)).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: /delete workspace/i })
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
    expect(screen.getByPlaceholderText('DELETE')).toHaveValue('DELET');
    expect(confirmButton).toBeDisabled();

    await user.type(screen.getByPlaceholderText('DELETE'), 'E');
    expect(screen.getByPlaceholderText('DELETE')).toHaveValue('DELETE');
    expect(confirmButton).not.toBeDisabled();
  });

  it('clears the typed confirmation after closing and reopening the dialog', async () => {
    const user = userEvent.setup();
    renderWithProviders(<WorkspaceDeleteDialog {...defaultProps} />);

    await user.click(screen.getByRole('button', { name: /delete workspace/i }));
    const confirmButton = screen.getByRole('button', {
      name: /confirm delete/i,
    });

    await user.type(screen.getByPlaceholderText('DELETE'), 'DELETE');
    expect(confirmButton).not.toBeDisabled();

    await user.click(screen.getByRole('button', { name: /cancel/i }));

    expect(screen.queryByPlaceholderText('DELETE')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /delete workspace/i }));

    expect(screen.getByPlaceholderText('DELETE')).toHaveValue('');
    expect(
      screen.getByRole('button', { name: /confirm delete/i })
    ).toBeDisabled();
  });

  it('deletes workspace and redirects on success', async () => {
    const { toast } = await import('sonner');
    const user = userEvent.setup();

    renderWithProviders(<WorkspaceDeleteDialog {...defaultProps} />);

    await user.click(screen.getByRole('button', { name: /delete workspace/i }));
    await user.type(screen.getByPlaceholderText('DELETE'), 'DELETE');
    await user.click(screen.getByRole('button', { name: /confirm delete/i }));

    await waitFor(() => {
      expect(defaultProps.onDelete).toHaveBeenCalledTimes(1);
    });

    await waitFor(() => {
      expect(setActiveMock).toHaveBeenCalledWith({ organizationId: 'ws-456' });
      expect(assignMock).toHaveBeenCalledWith('/ws/ws-456/overview');
    });

    expect(startSpanMock).toHaveBeenCalledWith(
      expect.objectContaining({
        op: OPERATIONS.WORKSPACE_DELETE,
        name: 'Delete workspace',
        attributes: expect.objectContaining({
          operation: OPERATIONS.WORKSPACE_DELETE,
          workspaceId: 'ws-123',
          result: 'attempt',
        }),
      }),
      expect.any(Function)
    );

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith(
        'Workspace deleted successfully.'
      );
    });

    expect(loggerInfoMock).toHaveBeenCalledWith(
      'Workspace deleted',
      expect.objectContaining({
        operation: OPERATIONS.WORKSPACE_DELETE,
        workspaceId: 'ws-123',
        result: 'success',
      })
    );
  });

  it('shows an error toast when setActive fails after deletion succeeds', async () => {
    const { toast } = await import('sonner');
    const user = userEvent.setup();

    setActiveMock.mockResolvedValue({
      error: { message: 'Failed to activate new workspace.' },
    });

    renderWithProviders(<WorkspaceDeleteDialog {...defaultProps} />);

    await user.click(screen.getByRole('button', { name: /delete workspace/i }));
    await user.type(screen.getByPlaceholderText('DELETE'), 'DELETE');
    await user.click(screen.getByRole('button', { name: /confirm delete/i }));

    await waitFor(() => {
      expect(defaultProps.onDelete).toHaveBeenCalledTimes(1);
    });

    await waitFor(() => {
      expect(setActiveMock).toHaveBeenCalledWith({ organizationId: 'ws-456' });
      expect(toast.error).toHaveBeenCalledWith(
        'Failed to activate new workspace.'
      );
    });

    expect(loggerErrorMock).toHaveBeenCalledWith(
      'Workspace deletion failed',
      expect.objectContaining({
        operation: OPERATIONS.WORKSPACE_DELETE,
        workspaceId: 'ws-123',
        result: 'failure',
        failureCategory: 'activation_failed',
      })
    );

    expect(assignMock).not.toHaveBeenCalled();
    expect(toast.success).not.toHaveBeenCalled();
  });

  it('shows error toast on deletion failure', async () => {
    const { toast } = await import('sonner');
    const user = userEvent.setup();

    defaultProps.onDelete = vi
      .fn()
      .mockRejectedValue(new Error('Permission denied'));

    renderWithProviders(<WorkspaceDeleteDialog {...defaultProps} />);

    await user.click(screen.getByRole('button', { name: /delete workspace/i }));
    await user.type(screen.getByPlaceholderText('DELETE'), 'DELETE');
    await user.click(screen.getByRole('button', { name: /confirm delete/i }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Permission denied');
    });

    expect(loggerErrorMock).toHaveBeenCalledWith(
      'Workspace deletion failed',
      expect.objectContaining({
        operation: OPERATIONS.WORKSPACE_DELETE,
        workspaceId: 'ws-123',
        result: 'failure',
        failureCategory: 'delete_failed',
      })
    );

    expect(
      screen.getByRole('button', { name: /confirm delete/i })
    ).toBeInTheDocument();
  });
});
