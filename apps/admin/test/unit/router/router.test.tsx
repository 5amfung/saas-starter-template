const {
  broadcastQueryClientMock,
  captureRouterErrorMock,
  createRouterMock,
  initObservabilityMock,
  setupRouterSsrQueryIntegrationMock,
} = vi.hoisted(() => ({
  broadcastQueryClientMock: vi.fn(),
  captureRouterErrorMock: vi.fn(),
  createRouterMock: vi.fn(() => ({ kind: 'router' })),
  initObservabilityMock: vi.fn(),
  setupRouterSsrQueryIntegrationMock: vi.fn(),
}));

vi.mock('@tanstack/query-broadcast-client-experimental', () => ({
  broadcastQueryClient: broadcastQueryClientMock,
}));

vi.mock('@tanstack/react-router', () => ({
  createRouter: createRouterMock,
}));

vi.mock('@tanstack/react-router-ssr-query', () => ({
  setupRouterSsrQueryIntegration: setupRouterSsrQueryIntegrationMock,
}));

vi.mock('@/lib/observability', () => ({
  captureRouterError: captureRouterErrorMock,
  initObservability: initObservabilityMock,
}));

vi.mock('@/routeTree.gen', () => ({
  routeTree: { kind: 'route-tree' },
}));

describe('admin router', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('initializes observability and reports router catches', async () => {
    vi.resetModules();
    const { getRouter } = await import('@/router');
    const router = getRouter();
    expect(createRouterMock).toHaveBeenCalled();
    const createRouterCalls = createRouterMock.mock.calls as unknown as Array<
      [
        {
          defaultOnCatch: (
            error: Error,
            errorInfo: { componentStack: string }
          ) => void;
        },
      ]
    >;
    const createRouterOptions = createRouterCalls[0][0];
    const defaultOnCatch = createRouterOptions.defaultOnCatch;

    expect(defaultOnCatch).toBeTypeOf('function');
    const error = new Error('router boom');
    const errorInfo = { componentStack: '\n    at RouteComponent' };
    defaultOnCatch(error, errorInfo);

    expect(router).toEqual({ kind: 'router' });
    expect(initObservabilityMock).toHaveBeenCalledWith({
      app: 'admin',
      appEnv: 'local',
      dsn: process.env.SENTRY_DSN,
      release: process.env.APP_RELEASE,
    });

    expect(captureRouterErrorMock).toHaveBeenCalledWith(error, errorInfo);
    expect(setupRouterSsrQueryIntegrationMock).toHaveBeenCalledWith({
      router: { kind: 'router' },
      queryClient: expect.anything(),
    });
  });
});
