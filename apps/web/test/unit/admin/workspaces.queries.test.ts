export {};

const { getWorkspaceMock, listWorkspacesMock } = vi.hoisted(() => ({
  getWorkspaceMock: vi.fn(),
  listWorkspacesMock: vi.fn(),
}));

vi.mock('@/admin/workspaces-query.functions', () => ({
  getWorkspace: getWorkspaceMock,
  listWorkspaces: listWorkspacesMock,
}));

describe('admin workspaces queries', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('builds list query options that normalize paging results', async () => {
    listWorkspacesMock.mockResolvedValueOnce({
      workspaces: [{ id: 'ws-1', name: 'Acme' }],
      total: 23,
    });

    const { adminWorkspaceListQueryOptions } =
      await import('@/admin/workspaces.queries');

    const options = adminWorkspaceListQueryOptions({
      page: 3,
      pageSize: 10,
      search: 'acme',
      filter: 'enterprise',
      sortBy: 'createdAt',
      sortDirection: 'desc',
    });

    expect(options.queryKey).toEqual([
      'admin',
      'workspaces',
      3,
      10,
      'acme',
      'enterprise',
      'createdAt',
      'desc',
    ]);

    const listQueryFn = options.queryFn as unknown as () => Promise<{
      workspaces: Array<{ id: string; name: string }>;
      total: number;
      page: number;
      pageSize: number;
      totalPages: number;
    }>;

    await expect(listQueryFn()).resolves.toEqual({
      workspaces: [{ id: 'ws-1', name: 'Acme' }],
      total: 23,
      page: 3,
      pageSize: 10,
      totalPages: 3,
    });

    expect(listWorkspacesMock).toHaveBeenCalledWith({
      data: {
        search: 'acme',
        filter: 'enterprise',
        limit: 10,
        offset: 20,
        sortBy: 'createdAt',
        sortDirection: 'desc',
      },
    });
  });

  it('builds detail query options that call the workspace bridge lazily', async () => {
    getWorkspaceMock.mockResolvedValueOnce({ id: 'ws-1', name: 'Acme' });

    const {
      adminWorkspaceDetailQueryOptions,
      ADMIN_WORKSPACE_DETAIL_QUERY_KEY,
    } = await import('@/admin/workspaces.queries');

    expect(ADMIN_WORKSPACE_DETAIL_QUERY_KEY('ws-1')).toEqual([
      'admin',
      'workspace',
      'ws-1',
    ]);

    const options = adminWorkspaceDetailQueryOptions('ws-1');

    expect(options.queryKey).toEqual(['admin', 'workspace', 'ws-1']);
    expect(options.retry).toBe(false);

    const detailQueryFn = options.queryFn as unknown as () => Promise<{
      id: string;
      name: string;
    }>;

    await expect(detailQueryFn()).resolves.toEqual({
      id: 'ws-1',
      name: 'Acme',
    });

    expect(getWorkspaceMock).toHaveBeenCalledWith({
      data: { workspaceId: 'ws-1' },
    });
  });
});
