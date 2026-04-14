import { Route } from '@/routes/_protected/ws/$workspaceId/integrations';

const { getWorkspaceCapabilitiesMock, notFoundMock } = vi.hoisted(() => ({
  getWorkspaceCapabilitiesMock: vi.fn(),
  notFoundMock: vi.fn(() => ({ routeId: '__root__', type: 'not-found' })),
}));

vi.mock('@/policy/workspace-capabilities.functions', () => ({
  getWorkspaceCapabilities: getWorkspaceCapabilitiesMock,
}));

vi.mock('@tanstack/react-router', async (importOriginal) => ({
  ...(await importOriginal()),
  notFound: notFoundMock,
}));

describe('workspace integrations route loader', () => {
  const runLoader = (workspaceId: string) =>
    (Route.options.loader as (...args: Array<unknown>) => Promise<unknown>)({
      params: { workspaceId },
    });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns capabilities when integrations access is allowed', async () => {
    getWorkspaceCapabilitiesMock.mockResolvedValue({
      canViewIntegrations: true,
      canManageIntegrations: true,
    });

    const result = await runLoader('ws-1');

    expect(getWorkspaceCapabilitiesMock).toHaveBeenCalledWith({
      data: { workspaceId: 'ws-1' },
    });
    expect(result).toEqual({
      canViewIntegrations: true,
      canManageIntegrations: true,
    });
  });

  it('throws notFound when integrations access is denied', async () => {
    getWorkspaceCapabilitiesMock.mockResolvedValue({
      canViewIntegrations: false,
      canManageIntegrations: false,
    });

    await expect(runLoader('ws-1')).rejects.toEqual({
      routeId: '__root__',
      type: 'not-found',
    });

    expect(notFoundMock).toHaveBeenCalledWith({ routeId: '__root__' });
  });
});
