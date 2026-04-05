// @vitest-environment jsdom
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@workspace/test-utils';
import { WorkspaceDeleteDialog } from '@/components/workspace/workspace-delete-dialog';

const { assignMock, mockToastSuccess, mockToastError } = vi.hoisted(() => ({
  assignMock: vi.fn(),
  mockToastSuccess: vi.fn(),
  mockToastError: vi.fn(),
}));

const { setActiveMock } = vi.hoisted(() => ({
  setActiveMock: vi.fn().mockResolvedValue({ error: null }),
}));

vi.mock('@workspace/auth/client', () => ({
  authClient: {
    organization: {
      setActive: setActiveMock,
    },
  },
}));

vi.mock('sonner', () => ({
  toast: { success: mockToastSuccess, error: mockToastError },
}));

describe('Workspace lifecycle flow', () => {
  beforeAll(() => {
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: {
        ...window.location,
        assign: assignMock,
      },
    });
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('workspace deletion', () => {
    const defaultProps = {
      workspaceId: 'ws-1',
      workspaceName: 'My Workspace',
      isDisabled: false,
      onDelete: vi.fn().mockResolvedValue('ws-2'),
    };

    it('full delete flow: open dialog → type confirmation → delete → navigate', async () => {
      const user = userEvent.setup();

      renderWithProviders(<WorkspaceDeleteDialog {...defaultProps} />);

      // Open dialog.
      await user.click(
        screen.getByRole('button', { name: /delete workspace/i })
      );

      // Verify workspace name is shown in the dialog.
      expect(screen.getByText(/My Workspace/)).toBeInTheDocument();

      // Confirm button should be disabled.
      const confirmButton = screen.getByRole('button', {
        name: /confirm delete/i,
      });
      expect(confirmButton).toBeDisabled();

      // Type DELETE to enable.
      const input = screen.getByPlaceholderText('DELETE');
      await user.type(input, 'DELETE');
      expect(confirmButton).toBeEnabled();

      // Click confirm.
      await user.click(confirmButton);

      await waitFor(() => {
        expect(defaultProps.onDelete).toHaveBeenCalledTimes(1);
      });

      // Verify success toast and document navigation.
      await waitFor(() => {
        expect(setActiveMock).toHaveBeenCalledWith({ organizationId: 'ws-2' });
        expect(mockToastSuccess).toHaveBeenCalledWith(
          'Workspace deleted successfully.'
        );
        expect(assignMock).toHaveBeenCalledWith('/ws/ws-2/overview');
      });
    });

    it('shows error toast when deletion fails', async () => {
      const user = userEvent.setup();
      const props = {
        ...defaultProps,
        onDelete: vi
          .fn()
          .mockRejectedValue(new Error('Cannot delete personal workspace')),
      };

      renderWithProviders(<WorkspaceDeleteDialog {...props} />);

      await user.click(
        screen.getByRole('button', { name: /delete workspace/i })
      );

      const input = screen.getByPlaceholderText('DELETE');
      await user.type(input, 'DELETE');
      await user.click(screen.getByRole('button', { name: /confirm delete/i }));

      await waitFor(() => {
        expect(mockToastError).toHaveBeenCalledWith(
          'Cannot delete personal workspace'
        );
      });
    });

    it('disables delete button when isDisabled is true', () => {
      renderWithProviders(
        <WorkspaceDeleteDialog {...defaultProps} isDisabled={true} />
      );

      expect(
        screen.getByRole('button', { name: /delete workspace/i })
      ).toBeDisabled();
    });

    it('resets confirmation text when dialog is closed and reopened', async () => {
      const user = userEvent.setup();

      renderWithProviders(<WorkspaceDeleteDialog {...defaultProps} />);

      // Open and type some text.
      await user.click(
        screen.getByRole('button', { name: /delete workspace/i })
      );
      await user.type(screen.getByPlaceholderText('DELETE'), 'DEL');

      // Close dialog.
      await user.click(screen.getByRole('button', { name: /cancel/i }));

      // Reopen dialog.
      await user.click(
        screen.getByRole('button', { name: /delete workspace/i })
      );

      // Confirmation should be reset.
      await waitFor(() => {
        expect(screen.getByPlaceholderText('DELETE')).toHaveValue('');
      });
    });

    it('shows error when no next workspace found after deletion', async () => {
      const user = userEvent.setup();
      const propsNoNext = {
        ...defaultProps,
        onDelete: vi
          .fn()
          .mockRejectedValue(
            new Error('Failed to find an active workspace after deletion.')
          ),
      };

      renderWithProviders(<WorkspaceDeleteDialog {...propsNoNext} />);

      await user.click(
        screen.getByRole('button', { name: /delete workspace/i })
      );
      await user.type(screen.getByPlaceholderText('DELETE'), 'DELETE');
      await user.click(screen.getByRole('button', { name: /confirm delete/i }));

      await waitFor(() => {
        expect(mockToastError).toHaveBeenCalledWith(
          'Failed to find an active workspace after deletion.'
        );
      });
    });
  });
});
