// @vitest-environment jsdom
import { act, renderHook, waitFor } from '@testing-library/react';
import { createHookWrapper } from '@/test/render';
import type { Plan } from '@/billing/plans';
import { useUpgradePrompt } from '@/hooks/use-upgrade-prompt';

const { mockCreateCheckoutSession, mockToastError } = vi.hoisted(() => ({
  mockCreateCheckoutSession: vi.fn(),
  mockToastError: vi.fn(),
}));

vi.mock('@/billing/billing.functions', () => ({
  createCheckoutSession: mockCreateCheckoutSession,
}));

vi.mock('sonner', () => ({
  toast: { error: mockToastError },
}));

const mockPlan: Plan = {
  id: 'pro',
  name: 'Pro',
  tier: 1,
  pricing: {
    monthly: { price: 49_00 },
    annual: { price: 490_00 },
  },
  limits: { maxWorkspaces: 5, maxMembersPerWorkspace: 5 },
  features: ['Up to 5 workspaces'],
  annualBonusFeatures: ['2 months free'],
};

describe('useUpgradePrompt', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('starts with dialog closed', () => {
    const { result } = renderHook(() => useUpgradePrompt(), {
      wrapper: createHookWrapper(),
    });
    expect(result.current.dialogProps.open).toBe(false);
  });

  it('show() populates dialog props', () => {
    const { result } = renderHook(() => useUpgradePrompt(), {
      wrapper: createHookWrapper(),
    });

    act(() => {
      result.current.show('Upgrade', 'You need more', mockPlan);
    });

    expect(result.current.dialogProps.open).toBe(true);
    expect(result.current.dialogProps.title).toBe('Upgrade');
    expect(result.current.dialogProps.description).toBe('You need more');
    expect(result.current.dialogProps.upgradePlan).toBe(mockPlan);
  });

  it('onOpenChange(false) closes dialog', () => {
    const { result } = renderHook(() => useUpgradePrompt(), {
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

  it('onUpgrade() fires mutation with correct planId and annual', async () => {
    mockCreateCheckoutSession.mockResolvedValue({
      url: 'https://checkout.stripe.com/test',
    });

    const { result } = renderHook(() => useUpgradePrompt(), {
      wrapper: createHookWrapper(),
    });

    act(() => {
      result.current.show('Upgrade', 'Description', mockPlan);
    });

    act(() => {
      result.current.dialogProps.onUpgrade();
    });

    await waitFor(() => {
      expect(mockCreateCheckoutSession).toHaveBeenCalledWith({
        data: { planId: 'pro', annual: false },
      });
    });
  });

  it('onUpgrade() is no-op when upgradePlan is null', () => {
    const { result } = renderHook(() => useUpgradePrompt(), {
      wrapper: createHookWrapper(),
    });

    act(() => {
      result.current.show('Limit Reached', 'Max tier', null);
    });

    act(() => {
      result.current.dialogProps.onUpgrade();
    });

    expect(mockCreateCheckoutSession).not.toHaveBeenCalled();
  });

  it('shows toast on checkout error', async () => {
    mockCreateCheckoutSession.mockRejectedValue(new Error('Checkout failed'));

    const { result } = renderHook(() => useUpgradePrompt(), {
      wrapper: createHookWrapper(),
    });

    act(() => {
      result.current.show('Upgrade', 'Description', mockPlan);
    });

    act(() => {
      result.current.dialogProps.onUpgrade();
    });

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith('Checkout failed');
    });
  });
});
