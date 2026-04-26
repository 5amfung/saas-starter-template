const { getDbMock, dbExecuteMock } = vi.hoisted(() => ({
  getDbMock: vi.fn(),
  dbExecuteMock: vi.fn(),
}));

vi.mock('@/init.server', () => ({
  getDb: getDbMock,
}));

describe('web health route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getDbMock.mockReturnValue({
      execute: dbExecuteMock,
    });
  });

  it('reports degraded status when the database check fails', async () => {
    dbExecuteMock.mockRejectedValueOnce(new Error('db offline'));

    const { Route } = await import('@/routes/health/route');
    const handlers = Route.options.server?.handlers as
      | {
          GET?: () => Promise<Response>;
        }
      | undefined;
    const handler = handlers?.GET;

    expect(handler).toBeTypeOf('function');

    const response = await handler!();
    const payload = await response.json();

    expect(payload.status).toBe('error');
    expect(payload.database).toEqual({
      status: 'error',
      error: 'db offline',
    });
  });
});
