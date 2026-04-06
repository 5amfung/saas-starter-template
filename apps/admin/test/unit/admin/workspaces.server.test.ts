import {
  deleteEntitlementOverrides,
  getWorkspaceDetail,
  listWorkspacesWithPlan,
  upsertEntitlementOverrides,
} from '@/admin/workspaces.server';

const {
  getAuthMock,
  getDbMock,
  listAdminWorkspacesMock,
  getAdminWorkspaceDetailMock,
  setAdminWorkspaceEntitlementOverridesMock,
  clearAdminWorkspaceEntitlementOverridesMock,
} = vi.hoisted(() => ({
  getAuthMock: vi.fn(),
  getDbMock: vi.fn(),
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
  getAuth: getAuthMock,
  getDb: getDbMock,
}));

describe('listWorkspacesWithPlan', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getAuthMock.mockReturnValue({ api: {} });
    getDbMock.mockReturnValue({ id: 'db' });
  });

  it('delegates to listAdminWorkspaces', async () => {
    listAdminWorkspacesMock.mockResolvedValueOnce({ workspaces: [], total: 0 });
    const result = await listWorkspacesWithPlan({
      limit: 10,
      offset: 0,
      filter: 'all',
    });

    expect(listAdminWorkspacesMock).toHaveBeenCalledWith({
      db: { id: 'db' },
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
    getAuthMock.mockReturnValue({ api: {} });
    getDbMock.mockReturnValue({ id: 'db' });
  });

  it('delegates to getAdminWorkspaceDetail', async () => {
    getAdminWorkspaceDetailMock.mockResolvedValueOnce(null);
    const result = await getWorkspaceDetail('ws-1');

    expect(getAdminWorkspaceDetailMock).toHaveBeenCalledWith({
      db: { id: 'db' },
      workspaceId: 'ws-1',
    });
    expect(result).toBeNull();
  });
});

describe('upsertEntitlementOverrides', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getAuthMock.mockReturnValue({ api: {} });
    getDbMock.mockReturnValue({ id: 'db' });
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
      db: { id: 'db' },
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
    getAuthMock.mockReturnValue({ api: {} });
    getDbMock.mockReturnValue({ id: 'db' });
  });

  it('delegates to clearAdminWorkspaceEntitlementOverrides', async () => {
    clearAdminWorkspaceEntitlementOverridesMock.mockResolvedValueOnce({
      success: true,
    });

    await deleteEntitlementOverrides('ws-1');

    expect(clearAdminWorkspaceEntitlementOverridesMock).toHaveBeenCalledWith({
      db: { id: 'db' },
      workspaceId: 'ws-1',
    });
  });
});
