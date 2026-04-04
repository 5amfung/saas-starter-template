import {
  deleteEntitlementOverrides,
  getWorkspaceDetail,
  listWorkspacesWithPlan,
  upsertEntitlementOverrides,
} from '@/admin/workspaces.server';

const {
  listAdminWorkspacesMock,
  getAdminWorkspaceDetailMock,
  setAdminWorkspaceEntitlementOverridesMock,
  clearAdminWorkspaceEntitlementOverridesMock,
} = vi.hoisted(() => ({
  listAdminWorkspacesMock: vi.fn(),
  getAdminWorkspaceDetailMock: vi.fn(),
  setAdminWorkspaceEntitlementOverridesMock: vi.fn(),
  clearAdminWorkspaceEntitlementOverridesMock: vi.fn(),
}));

vi.mock('@workspace/billing', () => ({
  listAdminWorkspaces: listAdminWorkspacesMock,
  getAdminWorkspaceDetail: getAdminWorkspaceDetailMock,
  setAdminWorkspaceEntitlementOverrides:
    setAdminWorkspaceEntitlementOverridesMock,
  clearAdminWorkspaceEntitlementOverrides:
    clearAdminWorkspaceEntitlementOverridesMock,
}));

vi.mock('@/init', () => ({
  auth: { api: {} },
  db: {},
}));

describe('listWorkspacesWithPlan', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('delegates to listAdminWorkspaces', async () => {
    listAdminWorkspacesMock.mockResolvedValueOnce({ workspaces: [], total: 0 });
    const result = await listWorkspacesWithPlan({
      limit: 10,
      offset: 0,
      filter: 'all',
    });

    expect(listAdminWorkspacesMock).toHaveBeenCalledWith({
      db: {},
      params: {
        limit: 10,
        offset: 0,
        filter: 'all',
      },
    });
    expect(result).toEqual({ workspaces: [], total: 0 });
  });
});

describe('getWorkspaceDetail', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('delegates to getAdminWorkspaceDetail', async () => {
    getAdminWorkspaceDetailMock.mockResolvedValueOnce(null);
    const result = await getWorkspaceDetail('ws-1');

    expect(getAdminWorkspaceDetailMock).toHaveBeenCalledWith({
      db: {},
      workspaceId: 'ws-1',
    });
    expect(result).toBeNull();
  });
});

describe('upsertEntitlementOverrides', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('delegates to setAdminWorkspaceEntitlementOverrides', async () => {
    setAdminWorkspaceEntitlementOverridesMock.mockResolvedValueOnce({
      success: true,
    });

    await upsertEntitlementOverrides({
      workspaceId: 'ws-1',
      limits: { members: 50 },
      features: { sso: true },
      quotas: { storageGb: 100 },
      notes: 'Test',
    });

    expect(setAdminWorkspaceEntitlementOverridesMock).toHaveBeenCalledWith({
      db: {},
      workspaceId: 'ws-1',
      limits: { members: 50 },
      features: { sso: true },
      quotas: { storageGb: 100 },
      notes: 'Test',
    });
  });
});

describe('deleteEntitlementOverrides', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('delegates to clearAdminWorkspaceEntitlementOverrides', async () => {
    clearAdminWorkspaceEntitlementOverridesMock.mockResolvedValueOnce({
      success: true,
    });

    await deleteEntitlementOverrides('ws-1');

    expect(clearAdminWorkspaceEntitlementOverridesMock).toHaveBeenCalledWith({
      db: {},
      workspaceId: 'ws-1',
    });
  });
});
