import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  assertInviteAllowed,
  assertWorkspaceFeature,
  assertWorkspaceLimit,
  clearWorkspaceEntitlementOverrides,
  createCheckoutSession,
  getWorkspaceBillingSnapshot,
  getWorkspaceEntitlementOverrides,
  getWorkspaceEntitlements,
  previewPlanChange,
  setWorkspaceEntitlementOverrides,
} from '../../../src/application/workspace-billing';

const {
  listSubscriptionsForWorkspaceMock,
  countWorkspaceMembersFromDbMock,
  getWorkspaceEntitlementOverridesRowMock,
  setWorkspaceEntitlementOverridesRowMock,
  clearWorkspaceEntitlementOverridesRowMock,
} = vi.hoisted(() => ({
  listSubscriptionsForWorkspaceMock: vi.fn(),
  countWorkspaceMembersFromDbMock: vi.fn(),
  getWorkspaceEntitlementOverridesRowMock: vi.fn(),
  setWorkspaceEntitlementOverridesRowMock: vi.fn(),
  clearWorkspaceEntitlementOverridesRowMock: vi.fn(),
}));

vi.mock('../../../src/infrastructure/workspace-repository', () => ({
  listSubscriptionsForWorkspace: listSubscriptionsForWorkspaceMock,
  countWorkspaceMembersFromDb: countWorkspaceMembersFromDbMock,
  getWorkspaceEntitlementOverridesRow: getWorkspaceEntitlementOverridesRowMock,
  setWorkspaceEntitlementOverridesRow: setWorkspaceEntitlementOverridesRowMock,
  clearWorkspaceEntitlementOverridesRow:
    clearWorkspaceEntitlementOverridesRowMock,
}));

const DB = {} as never;
const WORKSPACE_ID = 'ws_contract_test';

describe('workspace-billing application contracts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listSubscriptionsForWorkspaceMock.mockResolvedValue([]);
    countWorkspaceMembersFromDbMock.mockResolvedValue(0);
    getWorkspaceEntitlementOverridesRowMock.mockResolvedValue(null);
  });

  it('getWorkspaceBillingSnapshot returns resolved current entitlements', async () => {
    const snapshot = await getWorkspaceBillingSnapshot({
      db: DB,
      workspaceId: WORKSPACE_ID,
    });

    expect(snapshot.currentPlanId).toBe('free');
    expect(snapshot.currentEntitlements.limits.members).toBe(1);
    expect(snapshot.targetActionsByPlan.enterprise).toBe('contact_sales');
  });

  it('getWorkspaceEntitlements resolves enterprise overrides', async () => {
    listSubscriptionsForWorkspaceMock.mockResolvedValue([
      { plan: 'enterprise', status: 'active' },
    ]);
    getWorkspaceEntitlementOverridesRowMock.mockResolvedValue({
      id: 'ovr_1',
      limits: { members: 200 },
      features: { sso: false },
      quotas: null,
      notes: null,
    });

    const entitlements = await getWorkspaceEntitlements({
      db: DB,
      workspaceId: WORKSPACE_ID,
    });

    expect(entitlements.limits.members).toBe(200);
    expect(entitlements.features.sso).toBe(false);
  });

  it('previewPlanChange returns plan action and target', async () => {
    listSubscriptionsForWorkspaceMock.mockResolvedValue([
      { plan: 'pro', status: 'active' },
    ]);

    const preview = await previewPlanChange({
      db: DB,
      workspaceId: WORKSPACE_ID,
      targetPlanId: 'starter',
    });

    expect(preview.action).toBe('downgrade');
    expect(preview.targetPlan.id).toBe('starter');
  });

  it('getWorkspaceEntitlementOverrides returns override row data', async () => {
    getWorkspaceEntitlementOverridesRowMock.mockResolvedValue({
      id: 'ovr_2',
      limits: { members: 50 },
      features: { auditLogs: true },
      quotas: { storageGb: 500 },
      notes: 'contract test',
    });

    const overrides = await getWorkspaceEntitlementOverrides({
      db: DB,
      workspaceId: WORKSPACE_ID,
    });

    expect(overrides).toEqual({
      id: 'ovr_2',
      limits: { members: 50 },
      features: { auditLogs: true },
      quotas: { storageGb: 500 },
      notes: 'contract test',
    });
  });

  it('setWorkspaceEntitlementOverrides delegates persistence', async () => {
    await setWorkspaceEntitlementOverrides({
      db: DB,
      workspaceId: WORKSPACE_ID,
      limits: { members: 80 },
      features: { apiAccess: true },
      quotas: { storageGb: 100 },
      notes: 'new terms',
    });

    expect(setWorkspaceEntitlementOverridesRowMock).toHaveBeenCalledWith(DB, {
      workspaceId: WORKSPACE_ID,
      limits: { members: 80 },
      features: { apiAccess: true },
      quotas: { storageGb: 100 },
      notes: 'new terms',
    });
  });

  it('clearWorkspaceEntitlementOverrides delegates deletion', async () => {
    await clearWorkspaceEntitlementOverrides({
      db: DB,
      workspaceId: WORKSPACE_ID,
    });

    expect(clearWorkspaceEntitlementOverridesRowMock).toHaveBeenCalledWith(
      DB,
      WORKSPACE_ID
    );
  });

  it('assertWorkspaceLimit throws LIMIT_EXCEEDED when usage reaches the cap', async () => {
    listSubscriptionsForWorkspaceMock.mockResolvedValue([
      { plan: 'starter', status: 'active' },
    ]);
    countWorkspaceMembersFromDbMock.mockResolvedValue(5);

    await expect(
      assertWorkspaceLimit({
        db: DB,
        workspaceId: WORKSPACE_ID,
        key: 'members',
      })
    ).rejects.toMatchObject({
      code: 'LIMIT_EXCEEDED',
    });
  });

  it('assertWorkspaceFeature throws FEATURE_NOT_ENABLED for disabled feature', async () => {
    await expect(
      assertWorkspaceFeature({
        db: DB,
        workspaceId: WORKSPACE_ID,
        key: 'auditLogs',
      })
    ).rejects.toMatchObject({
      code: 'FEATURE_NOT_ENABLED',
    });
  });

  it('assertInviteAllowed enforces resolved enterprise member override', async () => {
    listSubscriptionsForWorkspaceMock.mockResolvedValue([
      { plan: 'enterprise', status: 'active' },
    ]);
    getWorkspaceEntitlementOverridesRowMock.mockResolvedValue({
      id: 'ovr_3',
      limits: { members: 2 },
      features: null,
      quotas: null,
      notes: null,
    });
    countWorkspaceMembersFromDbMock.mockResolvedValue(2);

    await expect(
      assertInviteAllowed({
        db: DB,
        workspaceId: WORKSPACE_ID,
      })
    ).rejects.toMatchObject({
      code: 'LIMIT_EXCEEDED',
    });
  });

  it('assertInviteAllowed does not read overrides for non-enterprise plans', async () => {
    listSubscriptionsForWorkspaceMock.mockResolvedValue([
      { plan: 'pro', status: 'active' },
    ]);
    countWorkspaceMembersFromDbMock.mockResolvedValue(1);

    await assertInviteAllowed({
      db: DB,
      workspaceId: WORKSPACE_ID,
    });

    expect(getWorkspaceEntitlementOverridesRowMock).not.toHaveBeenCalled();
  });

  it('createCheckoutSession rejects enterprise targets with CONTACT_SALES_REQUIRED', async () => {
    listSubscriptionsForWorkspaceMock.mockResolvedValue([
      { plan: 'pro', status: 'active' },
    ]);
    const execute = vi.fn();

    await expect(
      createCheckoutSession({
        db: DB,
        workspaceId: WORKSPACE_ID,
        targetPlanId: 'enterprise',
        annual: false,
        successUrl: 'https://example.com/success',
        cancelUrl: 'https://example.com/cancel',
        execute,
      })
    ).rejects.toMatchObject({
      code: 'CONTACT_SALES_REQUIRED',
    });

    expect(execute).not.toHaveBeenCalled();
  });

  it('createCheckoutSession executes self-serve upgrades', async () => {
    listSubscriptionsForWorkspaceMock.mockResolvedValue([]);
    const execute = vi.fn().mockResolvedValue({
      url: 'https://checkout.example.com/session',
      redirect: true,
    });

    const result = await createCheckoutSession({
      db: DB,
      workspaceId: WORKSPACE_ID,
      targetPlanId: 'starter',
      annual: true,
      successUrl: 'https://example.com/success',
      cancelUrl: 'https://example.com/cancel',
      execute,
    });

    expect(execute).toHaveBeenCalledWith({
      plan: 'starter',
      annual: true,
      referenceId: WORKSPACE_ID,
      customerType: 'organization',
      successUrl: 'https://example.com/success',
      cancelUrl: 'https://example.com/cancel',
    });
    expect(result).toEqual({
      url: 'https://checkout.example.com/session',
      redirect: true,
    });
  });
});
