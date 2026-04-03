// @vitest-environment jsdom
import * as React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AdminEntitlementOverrideForm } from '@/components/admin/admin-entitlement-override-form';

const { saveEntitlementOverridesMock, clearEntitlementOverridesMock } =
  vi.hoisted(() => ({
    saveEntitlementOverridesMock: vi.fn(),
    clearEntitlementOverridesMock: vi.fn(),
  }));

vi.mock('@/admin/workspaces.functions', () => ({
  saveEntitlementOverrides: saveEntitlementOverridesMock,
  clearEntitlementOverrides: clearEntitlementOverridesMock,
}));

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

  return render(
    <QueryClientProvider client={queryClient}>
      <AdminEntitlementOverrideForm
        workspaceId="ws_123"
        overrides={overrides}
      />
    </QueryClientProvider>
  );
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
});
