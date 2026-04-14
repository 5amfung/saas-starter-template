// @vitest-environment jsdom
import * as React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { OPERATIONS } from '@workspace/logging/client';
import type * as LoggingClient from '@workspace/logging/client';
import { AdminEntitlementOverrideForm } from '@/components/admin/admin-entitlement-override-form';
import { ADMIN_WORKSPACE_DETAIL_QUERY_KEY } from '@/admin/workspaces.queries';

const { saveEntitlementOverridesMock, clearEntitlementOverridesMock } =
  vi.hoisted(() => ({
    saveEntitlementOverridesMock: vi.fn(),
    clearEntitlementOverridesMock: vi.fn(),
  }));

const { startSpanMock } = vi.hoisted(() => ({
  startSpanMock: vi.fn(async (_options, callback: () => Promise<unknown>) =>
    callback()
  ),
}));

vi.mock('@/admin/workspaces.functions', () => ({
  saveEntitlementOverrides: saveEntitlementOverridesMock,
  clearEntitlementOverrides: clearEntitlementOverridesMock,
}));

vi.mock('@workspace/logging/client', async (importActual) => {
  const actual = await importActual<typeof LoggingClient>();
  return {
    ...actual,
    startWorkflowSpan: startSpanMock,
  };
});

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

function renderForm(
  overrides: React.ComponentProps<
    typeof AdminEntitlementOverrideForm
  >['overrides']
) {
  const queryClient = new QueryClient();
  const invalidateQueriesSpy = vi.spyOn(queryClient, 'invalidateQueries');

  return {
    invalidateQueriesSpy,
    ...render(
      <QueryClientProvider client={queryClient}>
        <AdminEntitlementOverrideForm
          workspaceId="ws_123"
          overrides={overrides}
        />
      </QueryClientProvider>
    ),
  };
}

describe('AdminEntitlementOverrideForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    saveEntitlementOverridesMock.mockResolvedValue({ success: true });
    clearEntitlementOverridesMock.mockResolvedValue({ success: true });
  });

  it('renders inherit, enabled, and disabled feature states from overrides', () => {
    renderForm({
      limits: null,
      features: {
        sso: true,
        auditLogs: false,
      },
      quotas: null,
      notes: null,
    });

    expect(screen.getByRole('combobox', { name: /sso/i })).toHaveValue(
      'enabled'
    );
    expect(screen.getByRole('combobox', { name: /audit logs/i })).toHaveValue(
      'disabled'
    );
    expect(screen.getByRole('combobox', { name: /api access/i })).toHaveValue(
      'inherit'
    );
  });

  it('omits inherited feature keys and preserves true/false overrides on save', async () => {
    const user = userEvent.setup();

    renderForm({
      limits: null,
      features: null,
      quotas: null,
      notes: null,
    });

    const ssoSelect = screen.getByRole('combobox', { name: /sso/i });
    const auditLogsSelect = screen.getByRole('combobox', {
      name: /audit logs/i,
    });

    await user.selectOptions(ssoSelect, 'enabled');
    await user.selectOptions(auditLogsSelect, 'disabled');

    await user.click(screen.getByRole('button', { name: /save overrides/i }));

    await waitFor(() => {
      expect(saveEntitlementOverridesMock).toHaveBeenCalledWith({
        data: {
          workspaceId: 'ws_123',
          features: {
            sso: true,
            auditLogs: false,
          },
        },
      });
    });

    expect(startSpanMock).toHaveBeenCalledWith(
      expect.objectContaining({
        op: OPERATIONS.ADMIN_WORKSPACE_ENTITLEMENTS_SAVE,
        name: 'Save entitlement overrides',
        attributes: expect.objectContaining({
          operation: OPERATIONS.ADMIN_WORKSPACE_ENTITLEMENTS_SAVE,
          workspaceId: 'ws_123',
          route: '/workspaces/$workspaceId',
          result: 'attempt',
        }),
      }),
      expect.any(Function)
    );
  });

  it('can revert an explicit true feature override back to inherit', async () => {
    const user = userEvent.setup();

    renderForm({
      limits: null,
      features: {
        sso: true,
      },
      quotas: null,
      notes: null,
    });

    const ssoSelect = screen.getByRole('combobox', { name: /sso/i });
    expect(ssoSelect).toHaveValue('enabled');

    await user.selectOptions(ssoSelect, 'inherit');
    await user.click(screen.getByRole('button', { name: /save overrides/i }));

    await waitFor(() => {
      expect(saveEntitlementOverridesMock).toHaveBeenCalledWith({
        data: {
          workspaceId: 'ws_123',
        },
      });
    });

    expect(startSpanMock).toHaveBeenCalledWith(
      expect.objectContaining({
        op: OPERATIONS.ADMIN_WORKSPACE_ENTITLEMENTS_SAVE,
        name: 'Save entitlement overrides',
        attributes: expect.objectContaining({
          operation: OPERATIONS.ADMIN_WORKSPACE_ENTITLEMENTS_SAVE,
          workspaceId: 'ws_123',
          route: '/workspaces/$workspaceId',
          result: 'attempt',
        }),
      }),
      expect.any(Function)
    );
  });

  it('can force a feature override to false from a previously true override', async () => {
    const user = userEvent.setup();

    renderForm({
      limits: null,
      features: {
        sso: true,
      },
      quotas: null,
      notes: null,
    });

    const ssoSelect = screen.getByRole('combobox', { name: /sso/i });
    expect(ssoSelect).toHaveValue('enabled');

    await user.selectOptions(ssoSelect, 'disabled');
    await user.click(screen.getByRole('button', { name: /save overrides/i }));

    await waitFor(() => {
      expect(saveEntitlementOverridesMock).toHaveBeenCalledWith({
        data: {
          workspaceId: 'ws_123',
          features: {
            sso: false,
          },
        },
      });
    });
  });

  it('round-trips numeric overrides and omits inherited values', async () => {
    const user = userEvent.setup();

    renderForm({
      limits: {
        members: -1,
        projects: 10,
      },
      features: null,
      quotas: null,
      notes: null,
    });

    // Turn "members" back to inherit by unchecking Unlimited and leaving input blank.
    const unlimitedToggles = screen.getAllByRole('checkbox', {
      name: /unlimited/i,
    });
    await user.click(unlimitedToggles[0]);

    await user.click(screen.getByRole('button', { name: /save overrides/i }));

    await waitFor(() => {
      expect(saveEntitlementOverridesMock).toHaveBeenCalledWith({
        data: {
          workspaceId: 'ws_123',
          limits: {
            projects: 10,
          },
        },
      });
    });
  });

  it('invalidates the canonical admin workspace detail query after save', async () => {
    const user = userEvent.setup();
    const { invalidateQueriesSpy } = renderForm({
      limits: null,
      features: null,
      quotas: null,
      notes: null,
    });

    await user.click(screen.getByRole('button', { name: /save overrides/i }));

    await waitFor(() => {
      expect(invalidateQueriesSpy).toHaveBeenCalledWith({
        queryKey: ADMIN_WORKSPACE_DETAIL_QUERY_KEY('ws_123'),
      });
    });
  });

  it('wraps clear all overrides in a workflow span', async () => {
    const user = userEvent.setup();

    renderForm({
      limits: null,
      features: null,
      quotas: null,
      notes: null,
    });

    await user.click(
      screen.getByRole('button', { name: /clear all overrides/i })
    );

    await waitFor(() => {
      expect(clearEntitlementOverridesMock).toHaveBeenCalledWith({
        data: {
          workspaceId: 'ws_123',
        },
      });
    });

    expect(startSpanMock).toHaveBeenCalledWith(
      expect.objectContaining({
        op: OPERATIONS.ADMIN_WORKSPACE_ENTITLEMENTS_CLEAR,
        name: 'Clear entitlement overrides',
        attributes: expect.objectContaining({
          operation: OPERATIONS.ADMIN_WORKSPACE_ENTITLEMENTS_CLEAR,
          workspaceId: 'ws_123',
          route: '/workspaces/$workspaceId',
          result: 'attempt',
        }),
      }),
      expect.any(Function)
    );
  });
});
