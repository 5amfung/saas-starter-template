// @vitest-environment jsdom
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@workspace/test-utils';
import type { Plan } from '@workspace/auth/plans';
import { WorkspaceSwitcher } from '@/components/workspace-switcher';

// ── Hoisted mocks ────────────────────────────────────────────────────────────

const {
  setActiveMock,
  createOrgMock,
  checkPlanLimitMock,
  navigateMock,
  toast,
} = vi.hoisted(() => ({
  setActiveMock: vi.fn(),
  createOrgMock: vi.fn(),
  checkPlanLimitMock: vi.fn(),
  navigateMock: vi.fn(),
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

// ── Module mocks ─────────────────────────────────────────────────────────────

vi.mock('@workspace/auth/client', () => ({
  authClient: {
    organization: {
      setActive: setActiveMock,
      create: createOrgMock,
    },
  },
}));

vi.mock('@/billing/billing.functions', () => ({
  checkPlanLimit: checkPlanLimitMock,
  createCheckoutSession: vi.fn(),
}));

vi.mock('@tanstack/react-router', async () => {
  const actual = await import('@tanstack/react-router');
  return {
    ...actual,
    useNavigate: () => navigateMock,
    Link: ({
      children,
      ...props
    }: {
      children?: React.ReactNode;
      [key: string]: unknown;
    }) => <a {...(props as React.ComponentProps<'a'>)}>{children}</a>,
  };
});

vi.mock('@workspace/ui/components/sidebar', () => ({
  SidebarMenu: ({ children }: { children: React.ReactNode }) => (
    <ul>{children}</ul>
  ),
  SidebarMenuItem: ({ children }: { children: React.ReactNode }) => (
    <li>{children}</li>
  ),
  SidebarMenuButton: ({
    children,
    render: _render,
    ...props
  }: {
    children?: React.ReactNode;
    render?: React.ReactElement;
    [key: string]: unknown;
  }) => (
    <button {...(props as React.ComponentProps<'button'>)}>{children}</button>
  ),
  useSidebar: () => ({ isMobile: false }),
}));

vi.mock('sonner', () => ({ toast }));

vi.mock('@workspace/ui/components/dropdown-menu', () => ({
  DropdownMenu: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  DropdownMenuTrigger: ({
    children,
  }: {
    children?: React.ReactNode;
    render?: React.ReactElement;
  }) => <button>{children}</button>,
  DropdownMenuContent: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  DropdownMenuGroup: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  DropdownMenuLabel: ({ children, ...props }: React.ComponentProps<'div'>) => (
    <div {...props}>{children}</div>
  ),
  DropdownMenuSeparator: () => <hr />,
  DropdownMenuItem: ({
    children,
    onClick,
  }: {
    children: React.ReactNode;
    onClick?: () => void;
  }) => <button onClick={onClick}>{children}</button>,
}));

vi.mock('@workspace/ui/components/alert-dialog', () => ({
  AlertDialog: ({
    children,
    open,
    onOpenChange,
  }: {
    children: React.ReactNode;
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
  }) =>
    open ? (
      <div role="dialog" data-testid="alert-dialog">
        {children}
        <button onClick={() => onOpenChange?.(false)}>__close_dialog__</button>
      </div>
    ) : null,
  AlertDialogContent: ({
    children,
  }: {
    children: React.ReactNode;
    size?: string;
  }) => <div>{children}</div>,
  AlertDialogHeader: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  AlertDialogTitle: ({ children }: { children: React.ReactNode }) => (
    <h2>{children}</h2>
  ),
  AlertDialogDescription: ({ children }: { children: React.ReactNode }) => (
    <p>{children}</p>
  ),
  AlertDialogFooter: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  AlertDialogCancel: ({
    children,
    disabled,
    onClick,
  }: {
    children: React.ReactNode;
    disabled?: boolean;
    onClick?: () => void;
  }) => (
    <button onClick={onClick} disabled={disabled}>
      {children}
    </button>
  ),
  AlertDialogAction: ({
    children,
    disabled,
    onClick,
  }: {
    children: React.ReactNode;
    disabled?: boolean;
    onClick?: (event: React.MouseEvent<HTMLButtonElement>) => void;
  }) => (
    <button onClick={onClick} disabled={disabled}>
      {children}
    </button>
  ),
}));

vi.mock('@/components/billing/upgrade-prompt-dialog', () => ({
  UpgradePromptDialog: ({
    open,
    title,
    description,
  }: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    title: string;
    description: string;
    upgradePlan: Plan | null;
    isUpgrading: boolean;
    onUpgrade: () => void;
    isAnnual: boolean;
    onToggleInterval: (annual: boolean) => void;
  }) =>
    open ? (
      <div data-testid="upgrade-prompt-dialog">
        <h3>{title}</h3>
        <p>{description}</p>
      </div>
    ) : null,
}));

// ── Fixtures ─────────────────────────────────────────────────────────────────

const STARTER_PLAN: Plan = {
  id: 'starter',
  name: 'Starter',
  tier: 1,
  pricing: {
    monthly: { price: 500 },
    annual: { price: 5000 },
  },
  limits: { maxWorkspaces: 5, maxMembersPerWorkspace: 5 },
  features: ['5 workspaces', '5 members per workspace'],
  annualBonusFeatures: ['2 months free'],
};

const defaultWorkspaces = [
  { id: 'ws-1', name: 'Workspace One', logo: <span>W1</span> },
  { id: 'ws-2', name: 'Workspace Two', logo: <span>W2</span> },
];

// ── Tests ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
});

describe('WorkspaceSwitcher', () => {
  it('displays the active workspace name', () => {
    renderWithProviders(
      <WorkspaceSwitcher
        workspaces={defaultWorkspaces}
        activeWorkspaceId="ws-1"
      />
    );
    // Workspace name appears in both trigger and dropdown list.
    expect(screen.getAllByText('Workspace One').length).toBeGreaterThan(0);
  });

  it('falls back to first workspace when activeWorkspaceId does not match', () => {
    renderWithProviders(
      <WorkspaceSwitcher
        workspaces={defaultWorkspaces}
        activeWorkspaceId="unknown-id"
      />
    );
    // First workspace is used as fallback.
    expect(screen.getAllByText('Workspace One').length).toBeGreaterThan(0);
  });

  it('renders all workspaces in the dropdown', () => {
    renderWithProviders(
      <WorkspaceSwitcher
        workspaces={defaultWorkspaces}
        activeWorkspaceId="ws-1"
      />
    );
    expect(screen.getAllByText('Workspace One').length).toBeGreaterThan(0);
    expect(screen.getByText('Workspace Two')).toBeInTheDocument();
  });

  it('renders "Add workspace" option in the dropdown', () => {
    renderWithProviders(
      <WorkspaceSwitcher
        workspaces={defaultWorkspaces}
        activeWorkspaceId="ws-1"
      />
    );
    expect(screen.getByText('Add workspace')).toBeInTheDocument();
  });

  it('calls setActive and navigates when a workspace is clicked', async () => {
    const user = userEvent.setup();
    setActiveMock.mockResolvedValue({ error: null });

    renderWithProviders(
      <WorkspaceSwitcher
        workspaces={defaultWorkspaces}
        activeWorkspaceId="ws-1"
      />
    );

    await user.click(screen.getByText('Workspace Two'));

    await waitFor(() => {
      expect(setActiveMock).toHaveBeenCalledWith({ organizationId: 'ws-2' });
    });

    await waitFor(() => {
      expect(navigateMock).toHaveBeenCalledWith({
        to: '/ws/$workspaceId/overview',
        params: { workspaceId: 'ws-2' },
      });
    });
  });

  it('shows error toast when switching workspace fails', async () => {
    const user = userEvent.setup();
    setActiveMock.mockResolvedValue({ error: { message: 'Switch failed' } });

    renderWithProviders(
      <WorkspaceSwitcher
        workspaces={defaultWorkspaces}
        activeWorkspaceId="ws-1"
      />
    );

    await user.click(screen.getByText('Workspace Two'));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Switch failed');
    });
  });

  it('opens create dialog when plan allows workspace creation', async () => {
    const user = userEvent.setup();
    checkPlanLimitMock.mockResolvedValue({
      allowed: true,
      current: 1,
      limit: 5,
      planName: 'Starter',
      upgradePlan: null,
    });

    renderWithProviders(
      <WorkspaceSwitcher
        workspaces={defaultWorkspaces}
        activeWorkspaceId="ws-1"
      />
    );

    await user.click(screen.getByText('Add workspace'));

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    expect(screen.getByText('Create Workspace')).toBeInTheDocument();
  });

  it('shows upgrade prompt when plan limit is reached', async () => {
    const user = userEvent.setup();
    checkPlanLimitMock.mockResolvedValue({
      allowed: false,
      current: 1,
      limit: 1,
      planName: 'Free',
      upgradePlan: STARTER_PLAN,
    });

    renderWithProviders(
      <WorkspaceSwitcher
        workspaces={defaultWorkspaces}
        activeWorkspaceId="ws-1"
      />
    );

    await user.click(screen.getByText('Add workspace'));

    await waitFor(() => {
      expect(screen.getByTestId('upgrade-prompt-dialog')).toBeInTheDocument();
    });

    expect(screen.getByText('Workspace limit reached')).toBeInTheDocument();
  });

  it('shows error toast when checkPlanLimit throws', async () => {
    const user = userEvent.setup();
    checkPlanLimitMock.mockRejectedValue(new Error('Network error'));

    renderWithProviders(
      <WorkspaceSwitcher
        workspaces={defaultWorkspaces}
        activeWorkspaceId="ws-1"
      />
    );

    await user.click(screen.getByText('Add workspace'));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        'Something went wrong. Please try again.'
      );
    });
  });

  it('shows validation error for invalid workspace name', async () => {
    const user = userEvent.setup();
    checkPlanLimitMock.mockResolvedValue({
      allowed: true,
      current: 1,
      limit: 5,
      planName: 'Starter',
      upgradePlan: null,
    });

    renderWithProviders(
      <WorkspaceSwitcher
        workspaces={defaultWorkspaces}
        activeWorkspaceId="ws-1"
      />
    );

    await user.click(screen.getByText('Add workspace'));

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    // Type an invalid name with special characters.
    await user.type(
      screen.getByPlaceholderText('Workspace name'),
      'Invalid@Name!'
    );
    await user.click(screen.getByRole('button', { name: /create/i }));

    await waitFor(() => {
      expect(
        screen.getByText('Only letters, numbers, spaces, -, and _ are allowed.')
      ).toBeInTheDocument();
    });
  });

  it('creates workspace and navigates on success', async () => {
    const user = userEvent.setup();
    checkPlanLimitMock.mockResolvedValue({
      allowed: true,
      current: 1,
      limit: 5,
      planName: 'Starter',
      upgradePlan: null,
    });
    createOrgMock.mockResolvedValue({
      data: { id: 'ws-new' },
      error: null,
    });
    setActiveMock.mockResolvedValue({ error: null });

    renderWithProviders(
      <WorkspaceSwitcher
        workspaces={defaultWorkspaces}
        activeWorkspaceId="ws-1"
      />
    );

    await user.click(screen.getByText('Add workspace'));

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    await user.type(
      screen.getByPlaceholderText('Workspace name'),
      'New Workspace'
    );
    await user.click(screen.getByRole('button', { name: /create/i }));

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith('Workspace created.');
    });

    await waitFor(() => {
      expect(navigateMock).toHaveBeenCalledWith({
        to: '/ws/$workspaceId/overview',
        params: { workspaceId: 'ws-new' },
      });
    });
  });

  it('shows error toast when workspace creation fails', async () => {
    const user = userEvent.setup();
    checkPlanLimitMock.mockResolvedValue({
      allowed: true,
      current: 1,
      limit: 5,
      planName: 'Starter',
      upgradePlan: null,
    });
    createOrgMock.mockResolvedValue({
      data: null,
      error: { message: 'Creation failed' },
    });

    renderWithProviders(
      <WorkspaceSwitcher
        workspaces={defaultWorkspaces}
        activeWorkspaceId="ws-1"
      />
    );

    await user.click(screen.getByText('Add workspace'));

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    await user.type(
      screen.getByPlaceholderText('Workspace name'),
      'New Workspace'
    );
    await user.click(screen.getByRole('button', { name: /create/i }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Creation failed');
    });
  });
});
