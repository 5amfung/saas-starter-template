export {};

const {
  createAuthMock,
  createDbMock,
  createEmailClientMock,
  createMockEmailClientMock,
} = vi.hoisted(() => ({
  createAuthMock: vi.fn(),
  createDbMock: vi.fn(),
  createEmailClientMock: vi.fn(),
  createMockEmailClientMock: vi.fn(),
}));

vi.mock('@workspace/auth/server', () => ({
  createAuth: createAuthMock,
}));

vi.mock('@workspace/db', () => ({
  createDb: createDbMock,
}));

vi.mock('@workspace/email', () => ({
  createEmailClient: createEmailClientMock,
  createMockEmailClient: createMockEmailClientMock,
}));

describe('admin workspace query keys', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('builds a stable list key from admin workspace filters', async () => {
    const { adminWorkspaceListQueryKey } =
      await import('@/admin/workspaces.queries');

    expect(
      adminWorkspaceListQueryKey({
        page: 2,
        pageSize: 25,
        search: 'acme',
        filter: 'enterprise',
        sortBy: 'name',
        sortDirection: 'asc',
      })
    ).toEqual([
      'admin',
      'workspaces',
      2,
      25,
      'acme',
      'enterprise',
      'name',
      'asc',
    ]);
  });

  it('builds a stable detail key', async () => {
    const { ADMIN_WORKSPACE_DETAIL_QUERY_KEY } =
      await import('@/admin/workspaces.queries');

    expect(ADMIN_WORKSPACE_DETAIL_QUERY_KEY('ws-1')).toEqual([
      'admin',
      'workspace',
      'ws-1',
    ]);
  });

  it('statically imports the real query module without constructing app services', async () => {
    vi.resetModules();

    await import('@/admin/workspaces.queries');

    expect(createDbMock).not.toHaveBeenCalled();
    expect(createEmailClientMock).not.toHaveBeenCalled();
    expect(createMockEmailClientMock).not.toHaveBeenCalled();
    expect(createAuthMock).not.toHaveBeenCalled();
  });
});
