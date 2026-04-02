// @vitest-environment jsdom
import { act, renderHook, waitFor } from '@testing-library/react';
import { createHookWrapper } from '@workspace/test-utils';
import type { PlanDefinition } from '@workspace/auth/plans';
import { useUpgradePrompt } from '@/hooks/use-upgrade-prompt';

const { mockCreateWorkspaceCheckoutSession, mockToastError } = vi.hoisted(
  () => ({
    mockCreateWorkspaceCheckoutSession: vi.fn(),
    mockToastError: vi.fn(),
  })
);

vi.mock('@/billing/billing.functions', () => ({
  createWorkspaceCheckoutSession: mockCreateWorkspaceCheckoutSession,
}));

vi.mock('sonner', () => ({
  toast: { error: mockToastError },
}));

const TEST_WORKSPACE_ID = 'ws_123';

const mockPlan: PlanDefinition = {
  id: 'pro',
  name: 'Pro',
  tier: 2,
  pricing: {
    monthly: { price: 49_00 },
    annual: { price: 490_00 },
  },
  entitlements: {
    limits: { members: 25, projects: 100, workspaces: 10, apiKeys: 5 },
    features: {
      sso: false,
      auditLogs: true,
      apiAccess: true,
      prioritySupport: true,
    },
    quotas: { storageGb: 50, apiCallsMonthly: 1000 },
  },
  stripeEnabled: true,
  isEnterprise: false,
};

const enterprisePlan: PlanDefinition = {
  id: 'enterprise',
  name: 'Enterprise',
  tier: 3,
  pricing: null,
  entitlements: {
    limits: { members: -1, projects: -1, workspaces: -1, apiKeys: -1 },
    features: {
      sso: true,
      auditLogs: true,
      apiAccess: true,
      prioritySupport: true,
    },
    quotas: { storageGb: -1, apiCallsMonthly: -1 },
  },
  stripeEnabled: true,
  isEnterprise: true,
};

describe('useUpgradePrompt', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('starts with dialog closed', () => {
    const { result } = renderHook(() => useUpgradePrompt(TEST_WORKSPACE_ID), {
      wrapper: createHookWrapper(),
    });
    expect(result.current.dialogProps.open).toBe(false);
  });

  it('show() populates dialog props', () => {
    const { result } = renderHook(() => useUpgradePrompt(TEST_WORKSPACE_ID), {
      wrapper: createHookWrapper(),
    });

    act(() => {
      result.current.show('Upgrade', 'You need more', mockPlan);
    });

    expect(result.current.dialogProps.open).toBe(true);
    expect(result.current.dialogProps.title).toBe('Upgrade');
    expect(result.current.dialogProps.description).toBe('You need more');
    expect(result.current.dialogProps.action).toEqual({
      type: 'checkout',
      plan: mockPlan,
    });
  });

  it('onOpenChange(false) closes dialog', () => {
    const { result } = renderHook(() => useUpgradePrompt(TEST_WORKSPACE_ID), {
      wrapper: createHookWrapper(),
    });

    act(() => {
      result.current.show('Upgrade', 'Description', mockPlan);
    });
    expect(result.current.dialogProps.open).toBe(true);

    act(() => {
      result.current.dialogProps.onOpenChange(false);
    });
    expect(result.current.dialogProps.open).toBe(false);
  });

  it('onAction() fires mutation with correct workspaceId, planId and annual', async () => {
    const locationHrefSpy = vi
      .spyOn(window, 'location', 'get')
      .mockReturnValue({
        ...window.location,
        href: '',
      } as Location);

    mockCreateWorkspaceCheckoutSession.mockResolvedValue({
      url: 'https://checkout.stripe.com/test',
    });

    const { result } = renderHook(() => useUpgradePrompt(TEST_WORKSPACE_ID), {
      wrapper: createHookWrapper(),
    });

    act(() => {
      result.current.show('Upgrade', 'Description', mockPlan);
    });

    act(() => {
      result.current.dialogProps.onAction();
    });

    await waitFor(() => {
      expect(mockCreateWorkspaceCheckoutSession).toHaveBeenCalledWith({
        data: { workspaceId: TEST_WORKSPACE_ID, planId: 'pro', annual: false },
      });
    });

    locationHrefSpy.mockRestore();
  });

  it('onAction() is no-op when no upgrade action exists', () => {
    const { result } = renderHook(() => useUpgradePrompt(TEST_WORKSPACE_ID), {
      wrapper: createHookWrapper(),
    });

    act(() => {
      result.current.show('Limit Reached', 'Max tier', null);
    });

    act(() => {
      result.current.dialogProps.onAction();
    });

    expect(mockCreateWorkspaceCheckoutSession).not.toHaveBeenCalled();
  });

  it('show() exposes contact-sales action for enterprise plan', () => {
    const { result } = renderHook(() => useUpgradePrompt(TEST_WORKSPACE_ID), {
      wrapper: createHookWrapper(),
    });

    act(() => {
      result.current.show('Upgrade', 'Description', enterprisePlan);
    });

    expect(result.current.dialogProps.action).toEqual({
      type: 'contact_sales',
      plan: enterprisePlan,
    });
  });

  it('shows toast on checkout error', async () => {
    mockCreateWorkspaceCheckoutSession.mockRejectedValue(
      new Error('Checkout failed')
    );

    const { result } = renderHook(() => useUpgradePrompt(TEST_WORKSPACE_ID), {
      wrapper: createHookWrapper(),
    });

    act(() => {
      result.current.show('Upgrade', 'Description', mockPlan);
    });

    act(() => {
      result.current.dialogProps.onAction();
    });

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith('Checkout failed');
    });
  });
});
