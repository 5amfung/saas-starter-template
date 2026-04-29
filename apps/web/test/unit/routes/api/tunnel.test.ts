describe('/api/tunnel route', () => {
  const sentryDsn = 'https://public@example.ingest.sentry.io/123456';

  async function getPostHandler() {
    vi.resetModules();
    vi.stubEnv('VITE_SENTRY_DSN', sentryDsn);

    const { Route } = await import('@/routes/api/tunnel');
    const handlers = Route.options.server?.handlers as
      | {
          POST?: (args: { request: Request }) => Promise<Response>;
        }
      | undefined;

    return handlers?.POST;
  }

  function createEnvelopeRequest(dsn = sentryDsn) {
    const envelope = [
      JSON.stringify({ dsn }),
      JSON.stringify({ type: 'event' }),
      JSON.stringify({ event_id: 'event_1' }),
    ].join('\n');

    return new Request('http://localhost/api/tunnel', {
      body: envelope,
      method: 'POST',
    });
  }

  beforeEach(() => {
    vi.unstubAllEnvs();
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(new Response(null, { status: 200 })))
    );
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('forwards a valid Sentry envelope to the configured upstream project', async () => {
    const handler = await getPostHandler();
    const request = createEnvelopeRequest();
    const response = await handler!({ request });

    expect(response.status).toBe(200);
    expect(fetch).toHaveBeenCalledWith(
      'https://example.ingest.sentry.io/api/123456/envelope/',
      expect.objectContaining({
        body: expect.any(ArrayBuffer),
        method: 'POST',
      })
    );
  });

  it('returns 400 for an invalid Sentry envelope', async () => {
    const handler = await getPostHandler();
    const request = createEnvelopeRequest(
      'https://public@other.ingest.sentry.io/123456'
    );
    const response = await handler!({ request });

    expect(response.status).toBe(400);
    expect(fetch).not.toHaveBeenCalled();
    await expect(response.json()).resolves.toEqual({
      error: 'Invalid Sentry envelope',
    });
  });

  it('returns 502 when Sentry cannot be reached', async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new Error('network error'));

    const handler = await getPostHandler();
    const response = await handler!({ request: createEnvelopeRequest() });

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toEqual({
      error: 'Error tunneling to Sentry',
    });
  });

  it('returns 503 when the tunnel is not configured', async () => {
    vi.resetModules();
    vi.stubEnv('VITE_SENTRY_DSN', '');

    const { Route } = await import('@/routes/api/tunnel');
    const handlers = Route.options.server?.handlers as
      | {
          POST?: (args: { request: Request }) => Promise<Response>;
        }
      | undefined;

    const response = await handlers?.POST?.({
      request: createEnvelopeRequest(),
    });

    expect(response?.status).toBe(503);
    expect(fetch).not.toHaveBeenCalled();
  });
});
