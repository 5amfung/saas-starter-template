// @vitest-environment jsdom
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@workspace/test-utils';
import { WorkspaceTransferOwnershipDialog } from '@/components/workspace/workspace-transfer-ownership-dialog';

const defaultProps = {
  open: true,
  workspaceName: 'Acme Workspace',
  targetMemberEmail: 'bob@example.com',
  isPending: false,
  onOpenChange: vi.fn(),
  onTransfer: vi.fn().mockResolvedValue(undefined),
};

describe('WorkspaceTransferOwnershipDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('keeps transfer disabled until TRANSFER is typed', async () => {
    const user = userEvent.setup();

    renderWithProviders(<WorkspaceTransferOwnershipDialog {...defaultProps} />);

    expect(
      screen.getByRole('button', { name: /transfer ownership/i })
    ).toBeDisabled();

    await user.type(screen.getByPlaceholderText('TRANSFER'), 'TRANSF');

    expect(
      screen.getByRole('button', { name: /transfer ownership/i })
    ).toBeDisabled();

    await user.type(screen.getByPlaceholderText('TRANSFER'), 'ER');

    expect(
      screen.getByRole('button', { name: /transfer ownership/i })
    ).toBeEnabled();
  });

  it('shows warning copy and spinner while pending', () => {
    renderWithProviders(
      <WorkspaceTransferOwnershipDialog {...defaultProps} isPending={true} />
    );

    expect(
      document
        .querySelector('[data-slot="alert-dialog-description"]')
        ?.tagName.toLowerCase()
    ).toBe('div');

    expect(
      screen.getByRole('heading', { name: /transfer workspace ownership/i })
    ).toBeInTheDocument();
    expect(screen.getByText(/acme workspace/i)).toBeInTheDocument();
    expect(screen.getByText(/demoted to admin/i)).toBeInTheDocument();
    expect(screen.getByText(/exactly one owner/i)).toBeInTheDocument();
    expect(
      screen.getByText(/billing stays with the workspace/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/payment transfer in stripe must be handled separately/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/new owner transfers ownership back to you/i)
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /transfer ownership/i })
    ).toBeDisabled();
    expect(document.body.querySelector('.animate-spin')).toBeInTheDocument();
  });

  it('calls onTransfer when confirmed and closes on cancel', async () => {
    const user = userEvent.setup();

    renderWithProviders(<WorkspaceTransferOwnershipDialog {...defaultProps} />);

    await user.type(screen.getByPlaceholderText('TRANSFER'), 'TRANSFER');
    await user.click(
      screen.getByRole('button', { name: /transfer ownership/i })
    );

    await waitFor(() => {
      expect(defaultProps.onTransfer).toHaveBeenCalledTimes(1);
    });

    await user.click(screen.getByRole('button', { name: /cancel/i }));

    expect(defaultProps.onOpenChange).toHaveBeenCalledWith(
      false,
      expect.anything()
    );
  });
});
