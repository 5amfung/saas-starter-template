import { OPERATIONS } from '@workspace/logging/server';
import { createServerFnMock } from '../../mocks/server-fn';
import type * as LoggingServer from '@workspace/logging/server';
import {
  clearEntitlementOverrides,
  saveEntitlementOverrides,
} from '@/admin/workspaces.functions';
import {
  getWorkspace,
  listWorkspaces,
} from '@/admin/workspaces-query.functions';

const {
  requireCurrentAdminAppCapabilityMock,
  listWorkspacesWithPlanMock,
  getWorkspaceDetailMock,
  upsertEntitlementOverridesMock,
  deleteEntitlementOverridesMock,
  startSpanMock,
  loggerInfoMock,
  loggerErrorMock,
} = vi.hoisted(() => ({
  requireCurrentAdminAppCapabilityMock: vi.fn(),
  listWorkspacesWithPlanMock: vi.fn(),
  getWorkspaceDetailMock: vi.fn(),
  upsertEntitlementOverridesMock: vi.fn(),
  deleteEntitlementOverridesMock: vi.fn(),
  startSpanMock: vi.fn(async (_options, callback: () => Promise<unknown>) =>
    callback()
  ),
  loggerInfoMock: vi.fn(),
  loggerErrorMock: vi.fn(),
}));

vi.mock('@tanstack/react-start', () => createServerFnMock());

vi.mock('@/policy/admin-app-capabilities.server', () => ({
  requireCurrentAdminAppCapability: requireCurrentAdminAppCapabilityMock,
}));

vi.mock('@/admin/workspaces.server', () => ({
  listWorkspacesWithPlan: listWorkspacesWithPlanMock,
  getWorkspaceDetail: getWorkspaceDetailMock,
  upsertEntitlementOverrides: upsertEntitlementOverridesMock,
  deleteEntitlementOverrides: deleteEntitlementOverridesMock,
}));

vi.mock('@workspace/logging/server', async (importActual) => {
  const actual = await importActual<typeof LoggingServer>();
  return {
    ...actual,
    startWorkflowSpan: startSpanMock,
    workflowLogger: {
      info: loggerInfoMock,
      error: loggerErrorMock,
    },
  };
});

describe('listWorkspaces', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects when workspace-read capability guard throws', async () => {
    requireCurrentAdminAppCapabilityMock.mockRejectedValueOnce(
      new Error('Forbidden')
    );
    await expect(
      listWorkspaces({ data: { limit: 10, offset: 0 } })
    ).rejects.toMatchObject({ message: 'Forbidden' });
  });

  it('passes params to listWorkspacesWithPlan', async () => {
    requireCurrentAdminAppCapabilityMock.mockResolvedValueOnce({});
    listWorkspacesWithPlanMock.mockResolvedValueOnce({
      workspaces: [],
      total: 0,
    });
    await listWorkspaces({
      data: { search: 'test', filter: 'enterprise', limit: 20, offset: 0 },
    });
    expect(requireCurrentAdminAppCapabilityMock).toHaveBeenCalledWith(
      'canViewWorkspaces'
    );
    expect(listWorkspacesWithPlanMock).toHaveBeenCalledWith({
      search: 'test',
      filter: 'enterprise',
      limit: 20,
      offset: 0,
    });
  });

  it('returns the query result', async () => {
    const result = { workspaces: [{ id: 'ws-1' }], total: 1 };
    requireCurrentAdminAppCapabilityMock.mockResolvedValueOnce({});
    listWorkspacesWithPlanMock.mockResolvedValueOnce(result);
    const data = await listWorkspaces({ data: { limit: 10, offset: 0 } });
    expect(data).toEqual(result);
  });
});

describe('getWorkspace', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects when workspace-billing capability guard throws', async () => {
    requireCurrentAdminAppCapabilityMock.mockRejectedValueOnce(
      new Error('Forbidden')
    );
    await expect(
      getWorkspace({ data: { workspaceId: 'ws-1' } })
    ).rejects.toMatchObject({ message: 'Forbidden' });
  });

  it('passes workspaceId to getWorkspaceDetail', async () => {
    requireCurrentAdminAppCapabilityMock.mockResolvedValueOnce({});
    getWorkspaceDetailMock.mockResolvedValueOnce({ id: 'ws-1' });
    await getWorkspace({ data: { workspaceId: 'ws-1' } });
    expect(requireCurrentAdminAppCapabilityMock).toHaveBeenCalledWith(
      'canViewWorkspaceBilling'
    );
    expect(getWorkspaceDetailMock).toHaveBeenCalledWith('ws-1');
  });

  it('returns the query result', async () => {
    const workspace = { id: 'ws-1', name: 'Test Workspace' };
    requireCurrentAdminAppCapabilityMock.mockResolvedValueOnce({});
    getWorkspaceDetailMock.mockResolvedValueOnce(workspace);
    const result = await getWorkspace({ data: { workspaceId: 'ws-1' } });
    expect(result).toEqual(workspace);
  });
});

describe('saveEntitlementOverrides', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects when override capability guard throws', async () => {
    requireCurrentAdminAppCapabilityMock.mockRejectedValueOnce(
      new Error('Forbidden')
    );
    await expect(
      saveEntitlementOverrides({
        data: { workspaceId: 'ws-1', limits: { members: 50 } },
      })
    ).rejects.toMatchObject({ message: 'Forbidden' });

    expect(startSpanMock).toHaveBeenCalledWith(
      expect.objectContaining({
        op: OPERATIONS.ADMIN_WORKSPACE_ENTITLEMENTS_SAVE,
        name: 'Save entitlement overrides',
        attributes: expect.objectContaining({
          operation: OPERATIONS.ADMIN_WORKSPACE_ENTITLEMENTS_SAVE,
          workspaceId: 'ws-1',
          route: '/workspaces/$workspaceId',
          result: 'attempt',
        }),
      }),
      expect.any(Function)
    );
    expect(loggerErrorMock).toHaveBeenCalledWith(
      'Admin entitlement overrides save failed',
      expect.objectContaining({
        operation: OPERATIONS.ADMIN_WORKSPACE_ENTITLEMENTS_SAVE,
        workspaceId: 'ws-1',
        route: '/workspaces/$workspaceId',
        result: 'failure',
        failureCategory: 'mutation_failed',
      })
    );
  });

  it('passes validated input to upsertEntitlementOverrides', async () => {
    requireCurrentAdminAppCapabilityMock.mockResolvedValueOnce({});
    upsertEntitlementOverridesMock.mockResolvedValueOnce(undefined);
    await saveEntitlementOverrides({
      data: {
        workspaceId: 'ws-1',
        limits: { members: 50 },
        features: { sso: true },
      },
    });
    expect(requireCurrentAdminAppCapabilityMock).toHaveBeenCalledWith(
      'canManageEntitlementOverrides'
    );
    expect(upsertEntitlementOverridesMock).toHaveBeenCalledWith({
      workspaceId: 'ws-1',
      limits: { members: 50 },
      features: { sso: true },
    });
    expect(loggerInfoMock).toHaveBeenCalledWith(
      'Admin entitlement overrides saved',
      expect.objectContaining({
        operation: OPERATIONS.ADMIN_WORKSPACE_ENTITLEMENTS_SAVE,
        workspaceId: 'ws-1',
        route: '/workspaces/$workspaceId',
        result: 'success',
      })
    );
  });

  it('returns success', async () => {
    requireCurrentAdminAppCapabilityMock.mockResolvedValueOnce({});
    upsertEntitlementOverridesMock.mockResolvedValueOnce(undefined);
    const result = await saveEntitlementOverrides({
      data: { workspaceId: 'ws-1' },
    });
    expect(result).toEqual({ success: true });
  });
});

describe('clearEntitlementOverrides', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects when override capability guard throws', async () => {
    requireCurrentAdminAppCapabilityMock.mockRejectedValueOnce(
      new Error('Forbidden')
    );
    await expect(
      clearEntitlementOverrides({ data: { workspaceId: 'ws-1' } })
    ).rejects.toMatchObject({ message: 'Forbidden' });

    expect(startSpanMock).toHaveBeenCalledWith(
      expect.objectContaining({
        op: OPERATIONS.ADMIN_WORKSPACE_ENTITLEMENTS_CLEAR,
        name: 'Clear entitlement overrides',
        attributes: expect.objectContaining({
          operation: OPERATIONS.ADMIN_WORKSPACE_ENTITLEMENTS_CLEAR,
          workspaceId: 'ws-1',
          route: '/workspaces/$workspaceId',
          result: 'attempt',
        }),
      }),
      expect.any(Function)
    );
    expect(loggerErrorMock).toHaveBeenCalledWith(
      'Admin entitlement overrides clear failed',
      expect.objectContaining({
        operation: OPERATIONS.ADMIN_WORKSPACE_ENTITLEMENTS_CLEAR,
        workspaceId: 'ws-1',
        route: '/workspaces/$workspaceId',
        result: 'failure',
        failureCategory: 'mutation_failed',
      })
    );
  });

  it('passes workspaceId to deleteEntitlementOverrides', async () => {
    requireCurrentAdminAppCapabilityMock.mockResolvedValueOnce({});
    deleteEntitlementOverridesMock.mockResolvedValueOnce(undefined);
    await clearEntitlementOverrides({ data: { workspaceId: 'ws-1' } });
    expect(requireCurrentAdminAppCapabilityMock).toHaveBeenCalledWith(
      'canManageEntitlementOverrides'
    );
    expect(deleteEntitlementOverridesMock).toHaveBeenCalledWith('ws-1');
    expect(loggerInfoMock).toHaveBeenCalledWith(
      'Admin entitlement overrides cleared',
      expect.objectContaining({
        operation: OPERATIONS.ADMIN_WORKSPACE_ENTITLEMENTS_CLEAR,
        workspaceId: 'ws-1',
        route: '/workspaces/$workspaceId',
        result: 'success',
      })
    );
  });

  it('returns success', async () => {
    requireCurrentAdminAppCapabilityMock.mockResolvedValueOnce({});
    deleteEntitlementOverridesMock.mockResolvedValueOnce(undefined);
    const result = await clearEntitlementOverrides({
      data: { workspaceId: 'ws-1' },
    });
    expect(result).toEqual({ success: true });
  });
});
