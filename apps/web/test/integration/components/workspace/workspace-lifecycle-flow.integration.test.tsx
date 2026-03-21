// @vitest-environment jsdom
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@workspace/test-utils';
import { WorkspaceDeleteDialog } from '@/components/workspace/workspace-delete-dialog';

const {
  deleteOrgMock,
  setActiveMock,
  navigateMock,
  mockToastSuccess,
  mockToastError,
} = vi.hoisted(() => ({
  deleteOrgMock: vi.fn(),
  setActiveMock: vi.fn(),
  navigateMock: vi.fn(),
  mockToastSuccess: vi.fn(),
  mockToastError: vi.fn(),
}));

vi.mock('@workspace/auth/client', () => ({
  authClient: {
    organization: {
      delete: deleteOrgMock,
      setActive: setActiveMock,
    },
  },
}));

vi.mock('@tanstack/react-router', async (importOriginal) => ({
  ...(await importOriginal()),
  useNavigate: () => navigateMock,
}));

vi.mock('sonner', () => ({
  toast: { success: mockToastSuccess, error: mockToastError },
}));

describe('Workspace lifecycle flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('workspace deletion', () => {
    const defaultProps = {
      workspaceId: 'ws-1',
      workspaceName: 'My Workspace',
      isDisabled: false,
      getNextWorkspaceIdAfterDelete: vi.fn().mockResolvedValue('ws-2'),
    };

    it('full delete flow: open dialog → type confirmation → delete → navigate', async () => {
      const user = userEvent.setup();
      deleteOrgMock.mockResolvedValue({ error: null });
      setActiveMock.mockResolvedValue({ error: null });

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

      // Verify API calls.
      await waitFor(() => {
        expect(deleteOrgMock).toHaveBeenCalledWith({
          organizationId: 'ws-1',
        });
      });

      await waitFor(() => {
        expect(defaultProps.getNextWorkspaceIdAfterDelete).toHaveBeenCalled();
      });

      await waitFor(() => {
        expect(setActiveMock).toHaveBeenCalledWith({
          organizationId: 'ws-2',
        });
      });

      // Verify success toast and navigation.
      await waitFor(() => {
        expect(mockToastSuccess).toHaveBeenCalledWith(
          'Workspace deleted successfully.'
        );
        expect(navigateMock).toHaveBeenCalledWith({
          to: '/ws/$workspaceId/overview',
          params: { workspaceId: 'ws-2' },
        });
      });
    });

    it('shows error toast when deletion fails', async () => {
      const user = userEvent.setup();
      deleteOrgMock.mockResolvedValue({
        error: { message: 'Cannot delete personal workspace' },
      });

      renderWithProviders(<WorkspaceDeleteDialog {...defaultProps} />);

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
      deleteOrgMock.mockResolvedValue({ error: null });
      const propsNoNext = {
        ...defaultProps,
        getNextWorkspaceIdAfterDelete: vi.fn().mockResolvedValue(null),
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
