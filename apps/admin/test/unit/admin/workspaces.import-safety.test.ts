export {};

const { getWorkspaceMock, listWorkspacesMock } = vi.hoisted(() => ({
  getWorkspaceMock: vi.fn(),
  listWorkspacesMock: vi.fn(),
}));

vi.mock('@/admin/workspaces-query.functions', () => ({
  getWorkspace: getWorkspaceMock,
  listWorkspaces: listWorkspacesMock,
}));

describe('admin workspace queries', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('imports the query module without invoking the server-function bridge', async () => {
    const previousApiKey = process.env.RESEND_API_KEY;
    delete process.env.RESEND_API_KEY;

    try {
      vi.resetModules();
      await expect(import('@/admin/workspaces.queries')).resolves.toBeDefined();
      expect(listWorkspacesMock).not.toHaveBeenCalled();
      expect(getWorkspaceMock).not.toHaveBeenCalled();
    } finally {
      if (previousApiKey === undefined) {
        delete process.env.RESEND_API_KEY;
      } else {
        process.env.RESEND_API_KEY = previousApiKey;
      }
    }
  });
});
