// @vitest-environment jsdom
import * as React from 'react';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@workspace/test-utils';
import { TypedConfirmDialog } from '@/components/shared/typed-confirm-dialog';

function renderDialog(
  props: Partial<React.ComponentProps<typeof TypedConfirmDialog>> = {}
) {
  const defaultProps: React.ComponentProps<typeof TypedConfirmDialog> = {
    open: true,
    onOpenChange: vi.fn(),
    title: 'Delete item',
    description: 'This action cannot be undone.',
    confirmLabel: 'Confirm delete',
    confirmationText: 'DELETE',
    onConfirm: vi.fn(),
    ...props,
  };

  renderWithProviders(<TypedConfirmDialog {...defaultProps} />);
  return defaultProps;
}

describe('TypedConfirmDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('keeps the confirm button disabled until the token matches exactly', async () => {
    const user = userEvent.setup();
    renderDialog();

    const confirmButton = screen.getByRole('button', {
      name: /confirm delete/i,
    });
    const confirmationInput = screen.getByPlaceholderText('DELETE');

    expect(confirmButton).toBeDisabled();

    await user.type(confirmationInput, 'delete');
    expect(confirmButton).toBeDisabled();

    await user.clear(confirmationInput);
    await user.type(confirmationInput, ' DELETE ');
    expect(confirmButton).toBeDisabled();

    await user.clear(confirmationInput);
    await user.type(confirmationInput, 'DELET');
    expect(confirmButton).toBeDisabled();

    await user.type(confirmationInput, 'E');
    expect(confirmButton).not.toBeDisabled();
  });

  it('blocks dismissal when external pending is true', async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();

    renderWithProviders(
      <TypedConfirmDialog
        open={true}
        onOpenChange={onOpenChange}
        title="Delete item"
        description="This action cannot be undone."
        confirmLabel="Confirm delete"
        confirmationText="DELETE"
        isPending={true}
        onConfirm={vi.fn()}
      />
    );

    expect(screen.getByRole('button', { name: /cancel/i })).toBeDisabled();

    await user.keyboard('{Escape}');

    expect(onOpenChange).not.toHaveBeenCalledWith(false);
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
  });

  it('clears the typed value when the dialog closes and reopens', async () => {
    const user = userEvent.setup();
    function Harness() {
      const [open, setOpen] = React.useState(true);
      return (
        <>
          <button type="button" onClick={() => setOpen(true)}>
            Reopen
          </button>
          <TypedConfirmDialog
            open={open}
            onOpenChange={setOpen}
            title="Delete item"
            description="This action cannot be undone."
            confirmLabel="Confirm delete"
            confirmationText="DELETE"
            onConfirm={vi.fn()}
          />
        </>
      );
    }

    renderWithProviders(<Harness />);

    const input = screen.getByPlaceholderText('DELETE');
    await user.type(input, 'DELETE');
    expect(input).toHaveValue('DELETE');

    await user.click(screen.getByRole('button', { name: /cancel/i }));

    await waitFor(() => {
      expect(screen.queryByPlaceholderText('DELETE')).not.toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /reopen/i }));
    expect(screen.getByPlaceholderText('DELETE')).toHaveValue('');
  });

  it('only calls onConfirm after a valid token and button click', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    renderDialog({ onConfirm });

    await user.type(screen.getByPlaceholderText('DELETE'), 'DELETE');
    expect(onConfirm).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: /confirm delete/i }));

    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('prevents closing while async confirmation is pending', async () => {
    const user = userEvent.setup();
    let resolveConfirm!: () => void;
    const onConfirm = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveConfirm = resolve;
        })
    );

    function Harness() {
      const [open, setOpen] = React.useState(true);
      return (
        <TypedConfirmDialog
          open={open}
          onOpenChange={setOpen}
          title="Delete item"
          description="This action cannot be undone."
          confirmLabel="Confirm delete"
          confirmationText="DELETE"
          onConfirm={onConfirm}
        />
      );
    }

    renderWithProviders(<Harness />);

    await user.type(screen.getByPlaceholderText('DELETE'), 'DELETE');

    const confirmButton = screen.getByRole('button', {
      name: /confirm delete/i,
    });

    fireEvent.click(confirmButton);

    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(confirmButton).toBeDisabled();
    expect(screen.getByRole('button', { name: /cancel/i })).toBeDisabled();

    await user.click(screen.getByRole('button', { name: /cancel/i }));
    expect(screen.getByPlaceholderText('DELETE')).toBeInTheDocument();

    resolveConfirm();

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: /confirm delete/i })
      ).not.toBeDisabled();
    });
  });

  it('starts a fresh session when the parent closes and reopens while pending', async () => {
    const user = userEvent.setup();
    let resolveConfirm!: () => void;

    function Harness() {
      const [open, setOpen] = React.useState(true);

      const onConfirm = React.useCallback(() => {
        setOpen(false);
        return new Promise<void>((resolve) => {
          resolveConfirm = resolve;
        });
      }, []);

      return (
        <>
          <button type="button" onClick={() => setOpen(true)}>
            Parent reopen
          </button>
          <TypedConfirmDialog
            open={open}
            onOpenChange={setOpen}
            title="Delete item"
            description="This action cannot be undone."
            confirmLabel="Confirm delete"
            confirmationText="DELETE"
            onConfirm={onConfirm}
          />
        </>
      );
    }

    renderWithProviders(<Harness />);

    await user.type(screen.getByPlaceholderText('DELETE'), 'DELETE');
    await user.click(screen.getByRole('button', { name: /confirm delete/i }));

    expect(screen.queryByPlaceholderText('DELETE')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /parent reopen/i }));
    const reopenedInput = screen.getByPlaceholderText('DELETE');
    expect(reopenedInput).toHaveValue('');

    await user.type(reopenedInput, 'DELETE');
    expect(
      screen.getByRole('button', { name: /confirm delete/i })
    ).not.toBeDisabled();

    resolveConfirm();
  });

  it('keeps the dialog open and unwinds cleanly when async confirmation rejects', async () => {
    const user = userEvent.setup();
    const onUnhandledRejection = vi.fn();
    const onConfirm = vi.fn().mockRejectedValue(new Error('Permission denied'));

    window.addEventListener('unhandledrejection', onUnhandledRejection);

    try {
      renderDialog({ onConfirm });

      await user.type(screen.getByPlaceholderText('DELETE'), 'DELETE');
      await user.click(screen.getByRole('button', { name: /confirm delete/i }));

      await waitFor(() => {
        expect(onConfirm).toHaveBeenCalledTimes(1);
      });

      await waitFor(() => {
        expect(
          screen.getByRole('button', { name: /confirm delete/i })
        ).not.toBeDisabled();
      });

      expect(screen.getByPlaceholderText('DELETE')).toBeInTheDocument();
      expect(onUnhandledRejection).not.toHaveBeenCalled();
    } finally {
      window.removeEventListener('unhandledrejection', onUnhandledRejection);
    }
  });

  it('keeps the dialog open and unwinds cleanly when onConfirm throws synchronously', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn(() => {
      throw new Error('Permission denied');
    });

    renderDialog({ onConfirm });

    await user.type(screen.getByPlaceholderText('DELETE'), 'DELETE');
    await user.click(screen.getByRole('button', { name: /confirm delete/i }));

    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: /confirm delete/i })
      ).not.toBeDisabled();
    });
  });

  it('does not warn when unmounted while async confirmation is pending', async () => {
    const user = userEvent.setup();
    let resolveConfirm!: () => void;
    const onConfirm = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveConfirm = resolve;
        })
    );
    const consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});

    const { unmount } = renderWithProviders(
      <TypedConfirmDialog
        open={true}
        onOpenChange={vi.fn()}
        title="Delete item"
        description="This action cannot be undone."
        confirmLabel="Confirm delete"
        confirmationText="DELETE"
        onConfirm={onConfirm}
      />
    );

    await user.type(screen.getByPlaceholderText('DELETE'), 'DELETE');
    await user.click(screen.getByRole('button', { name: /confirm delete/i }));

    unmount();
    resolveConfirm();

    await waitFor(() => {
      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });

    consoleErrorSpy.mockRestore();
  });

  it('keeps the dialog pending for a callable thenable until it settles', async () => {
    const user = userEvent.setup();
    let resolveThenable!: () => void;
    const thenable = Object.assign(() => undefined, {
      then(resolve: () => void) {
        resolveThenable = resolve;
        return Promise.resolve();
      },
    }) as unknown as (() => void) & PromiseLike<void>;
    const onConfirm: React.ComponentProps<
      typeof TypedConfirmDialog
    >['onConfirm'] = vi.fn(() => thenable);

    renderDialog({ onConfirm });

    await user.type(screen.getByPlaceholderText('DELETE'), 'DELETE');
    await user.click(screen.getByRole('button', { name: /confirm delete/i }));

    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(
      screen.getByRole('button', { name: /confirm delete/i })
    ).toBeDisabled();
    expect(screen.getByRole('button', { name: /cancel/i })).toBeDisabled();

    resolveThenable();

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: /confirm delete/i })
      ).not.toBeDisabled();
    });
  });
});
