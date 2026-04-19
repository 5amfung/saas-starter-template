const { verifyWorkspaceApiKeyMock } = vi.hoisted(() => ({
  verifyWorkspaceApiKeyMock: vi.fn(),
}));

vi.mock('@/api/api-key-auth.server', () => ({
  verifyWorkspaceApiKey: verifyWorkspaceApiKeyMock,
}));

describe('/api/hello route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  async function getHandler() {
    vi.resetModules();
    const { Route } = await import('@/routes/api/hello');
    const handlers = Route.options.server?.handlers as
      | {
          POST?: (args: { request: Request }) => Promise<Response>;
        }
      | undefined;

    return handlers?.POST;
  }

  it('returns hello payload on success', async () => {
    verifyWorkspaceApiKeyMock.mockResolvedValueOnce({
      ok: true,
      keyId: 'key_1',
      workspaceId: 'ws_1',
    });

    const handler = await getHandler();
    const response = await handler!({
      request: new Request('http://localhost/api/hello', {
        method: 'POST',
        headers: {
          'x-api-key': 'sr_secret',
          'x-api-workspace-id': 'ws_1',
        },
      }),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ message: 'hello' });
  });

  it('returns 400 when the workspace header is missing', async () => {
    verifyWorkspaceApiKeyMock.mockResolvedValueOnce({
      ok: false,
      reason: 'missing-workspace',
    });

    const handler = await getHandler();
    const response = await handler!({
      request: new Request('http://localhost/api/hello', {
        method: 'POST',
        headers: {
          'x-api-key': 'sr_secret',
        },
      }),
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: 'Missing required header: x-api-workspace-id',
    });
  });

  it('returns 403 when the verified key belongs to another workspace', async () => {
    verifyWorkspaceApiKeyMock.mockResolvedValueOnce({
      ok: false,
      reason: 'forbidden',
      keyId: 'key_1',
    });

    const handler = await getHandler();
    const response = await handler!({
      request: new Request('http://localhost/api/hello', {
        method: 'POST',
        headers: {
          'x-api-key': 'sr_secret',
          'x-api-workspace-id': 'ws_1',
        },
      }),
    });

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      error: 'API key is not authorized for this workspace',
    });
  });

  it('returns 401 when the api key is invalid', async () => {
    verifyWorkspaceApiKeyMock.mockResolvedValueOnce({
      ok: false,
      reason: 'invalid-key',
    });

    const handler = await getHandler();
    const response = await handler!({
      request: new Request('http://localhost/api/hello', {
        method: 'POST',
        headers: {
          'x-api-key': 'sr_secret',
          'x-api-workspace-id': 'ws_1',
        },
      }),
    });

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      error: 'Invalid API key',
    });
  });
});
