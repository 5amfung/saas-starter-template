describe('/api/tunnel route', () => {
  const sentryDsn = 'https://public@example.ingest.sentry.io/123456';

  async function getPostHandler(dsn = sentryDsn) {
    vi.resetModules();
    vi.stubEnv('VITE_SENTRY_DSN', dsn);

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

  it('forwards self-hosted Sentry envelopes without dropping the port or path prefix', async () => {
    const selfHostedDsn =
      'https://public@self-hosted.example.com:8443/sentry/123';
    const handler = await getPostHandler(selfHostedDsn);
    const request = createEnvelopeRequest(selfHostedDsn);
    const response = await handler!({ request });

    expect(response.status).toBe(200);
    expect(fetch).toHaveBeenCalledWith(
      'https://self-hosted.example.com:8443/sentry/api/123/envelope/',
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

  it('forwards upstream Sentry error status and rate limit headers', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response('rate limited', {
        headers: {
          'retry-after': '60',
          'x-sentry-rate-limits': '60:error:project:quota_exceeded',
        },
        status: 429,
        statusText: 'Too Many Requests',
      })
    );

    const handler = await getPostHandler();
    const response = await handler!({ request: createEnvelopeRequest() });

    expect(response.status).toBe(429);
    expect(response.statusText).toBe('Too Many Requests');
    expect(response.headers.get('retry-after')).toBe('60');
    expect(response.headers.get('x-sentry-rate-limits')).toBe(
      '60:error:project:quota_exceeded'
    );
    await expect(response.text()).resolves.toBe('rate limited');
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
