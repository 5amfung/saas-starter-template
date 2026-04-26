import {
  createWorkspaceApiKey,
  deleteEntitlementOverrides,
  deleteWorkspaceApiKey,
  getWorkspaceDetail,
  listWorkspaceApiKeys,
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
  createApiKeyMock,
  executeMock,
} = vi.hoisted(() => ({
  getAuthMock: vi.fn(),
  getDbMock: vi.fn(),
  listAdminWorkspacesMock: vi.fn(),
  getAdminWorkspaceDetailMock: vi.fn(),
  setAdminWorkspaceEntitlementOverridesMock: vi.fn(),
  clearAdminWorkspaceEntitlementOverridesMock: vi.fn(),
  createApiKeyMock: vi.fn(),
  executeMock: vi.fn(),
}));

const { getRequestHeadersMock } = vi.hoisted(() => ({
  getRequestHeadersMock: vi.fn(),
}));

vi.mock('@tanstack/react-start/server', () => ({
  getRequestHeaders: getRequestHeadersMock,
}));

vi.mock('@/billing/core', () => ({
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
    getRequestHeadersMock.mockReturnValue(new Headers());
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

describe('listWorkspaceApiKeys', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getRequestHeadersMock.mockReturnValue(new Headers());
    getAuthMock.mockReturnValue({ api: {} });
    getDbMock.mockReturnValue({
      id: 'db',
      execute: executeMock,
    });
  });

  it('lists only system-managed organization-owned keys for the workspace', async () => {
    executeMock.mockResolvedValueOnce({
      rows: [
        {
          id: 'key-2',
          name: 'Production support key',
          start: 'abcd',
          prefix: 'sk_',
          configId: 'system-managed',
          createdAt: new Date('2026-04-15T00:00:00.000Z'),
        },
      ],
    });

    const result = await listWorkspaceApiKeys('ws-1');

    expect(executeMock).toHaveBeenCalled();
    expect(result).toEqual([
      {
        id: 'key-2',
        name: 'Production support key',
        start: 'abcd',
        prefix: 'sk_',
        configId: 'system-managed',
        createdAt: new Date('2026-04-15T00:00:00.000Z'),
      },
    ]);
  });
});

describe('getWorkspaceDetail', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getRequestHeadersMock.mockReturnValue(new Headers());
    getAuthMock.mockReturnValue({ api: {} });
    getDbMock.mockReturnValue({
      id: 'db',
      execute: executeMock,
    });
  });

  it('returns null when the workspace is missing', async () => {
    getAdminWorkspaceDetailMock.mockResolvedValueOnce(null);

    await expect(getWorkspaceDetail('ws-1')).resolves.toBeNull();
  });

  it('appends workspace api keys to the detail payload', async () => {
    getAdminWorkspaceDetailMock.mockResolvedValueOnce({
      id: 'ws-1',
      name: 'Workspace',
      slug: 'workspace',
      logo: null,
      createdAt: new Date('2026-04-15T00:00:00.000Z'),
      ownerEmail: 'owner@example.com',
      ownerName: 'Owner',
      ownerUserId: 'owner-1',
      memberCount: 2,
      planId: 'enterprise',
      entitlements: {},
      productPolicy: {},
      subscription: null,
      overrides: null,
    });
    executeMock.mockResolvedValueOnce({
      rows: [
        {
          id: 'key-1',
          name: 'Production support key',
          start: 'abcd',
          prefix: 'sk_',
          configId: 'system-managed',
          createdAt: new Date('2026-04-15T01:00:00.000Z'),
        },
      ],
    });

    const result = await getWorkspaceDetail('ws-1');

    expect(result).toMatchObject({
      id: 'ws-1',
      apiKeys: [
        {
          id: 'key-1',
          name: 'Production support key',
          start: 'abcd',
          prefix: 'sk_',
          configId: 'system-managed',
        },
      ],
    });
  });
});

describe('createWorkspaceApiKey', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getRequestHeadersMock.mockReturnValue(new Headers());
    getAuthMock.mockReturnValue({
      api: {
        createApiKey: createApiKeyMock,
      },
    });
    getDbMock.mockReturnValue({ id: 'db' });
  });

  it('creates a named workspace-owned api key via the workspace owner', async () => {
    getAdminWorkspaceDetailMock.mockResolvedValueOnce({
      ownerUserId: 'owner-1',
    });
    createApiKeyMock.mockResolvedValueOnce({
      id: 'key-1',
      key: 'sk_secret_123',
      start: 'secret',
      prefix: 'sk_',
    });

    const result = await createWorkspaceApiKey({
      workspaceId: 'ws-1',
      name: 'Production support key',
    });

    expect(createApiKeyMock).toHaveBeenCalledWith({
      body: {
        userId: 'owner-1',
        organizationId: 'ws-1',
        configId: 'system-managed',
        name: 'Production support key',
        prefix: 'sk_',
      },
    });
    expect(result).toEqual({
      id: 'key-1',
      key: 'sk_secret_123',
      start: 'secret',
      prefix: 'sk_',
    });
  });

  it('throws when the workspace owner is missing', async () => {
    getAdminWorkspaceDetailMock.mockResolvedValueOnce({
      ownerUserId: null,
    });

    await expect(
      createWorkspaceApiKey({
        workspaceId: 'ws-1',
        name: 'Production support key',
      })
    ).rejects.toMatchObject({ message: 'Workspace owner not found.' });
  });
});

describe('deleteWorkspaceApiKey', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getRequestHeadersMock.mockReturnValue(new Headers());
    getAuthMock.mockReturnValue({ api: {} });
    getDbMock.mockReturnValue({
      id: 'db',
      execute: executeMock,
    });
  });

  it('hard deletes a workspace-owned system-managed api key', async () => {
    executeMock
      .mockResolvedValueOnce({
        rows: [{ id: 'key-1' }],
      })
      .mockResolvedValueOnce({ rows: [] });

    await deleteWorkspaceApiKey({
      workspaceId: 'ws-1',
      apiKeyId: 'key-1',
    });

    expect(executeMock).toHaveBeenCalledTimes(2);
  });

  it('throws when the api key does not belong to the workspace', async () => {
    executeMock.mockResolvedValueOnce({ rows: [] });

    await expect(
      deleteWorkspaceApiKey({
        workspaceId: 'ws-1',
        apiKeyId: 'key-1',
      })
    ).rejects.toMatchObject({ message: 'API key not found.' });
  });
});

describe('upsertEntitlementOverrides', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getRequestHeadersMock.mockReturnValue(new Headers());
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
    getRequestHeadersMock.mockReturnValue(new Headers());
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
