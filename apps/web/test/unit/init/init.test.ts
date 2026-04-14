const {
  createAuthMock,
  createDbMock,
  createEmailClientMock,
  createMockEmailClientMock,
  getEmailClientMock,
} = vi.hoisted(() => ({
  createAuthMock: vi.fn(),
  createDbMock: vi.fn(),
  createEmailClientMock: vi.fn(),
  createMockEmailClientMock: vi.fn(),
  getEmailClientMock: vi.fn(),
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

describe('web init getters', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.E2E_MOCK_EMAIL;
  });

  it('does not construct services at import time and memoizes getters', async () => {
    vi.resetModules();
    const init = await import('@/init');

    const db = { kind: 'db' };
    const emailClient = { kind: 'email-client' };
    const auth = { kind: 'auth' };

    expect(createDbMock).not.toHaveBeenCalled();
    expect(createEmailClientMock).not.toHaveBeenCalled();
    expect(createMockEmailClientMock).not.toHaveBeenCalled();
    expect(createAuthMock).not.toHaveBeenCalled();

    createDbMock.mockReturnValue(db);
    createEmailClientMock.mockReturnValue(emailClient);
    createAuthMock.mockReturnValue(auth);

    expect(init.getDb()).toBe(db);
    expect(init.getDb()).toBe(db);
    expect(createDbMock).toHaveBeenCalledTimes(1);

    expect(init.getEmailClient()).toBe(emailClient);
    expect(init.getEmailClient()).toBe(emailClient);
    expect(createEmailClientMock).toHaveBeenCalledTimes(1);
    expect(createMockEmailClientMock).not.toHaveBeenCalled();

    expect(init.getAuth()).toBe(auth);
    expect(init.getAuth()).toBe(auth);
    expect(createAuthMock).toHaveBeenCalledTimes(1);
    expect(createAuthMock).toHaveBeenCalledWith({
      db,
      emailClient,
      baseUrl: process.env.BETTER_AUTH_URL,
      secret: process.env.BETTER_AUTH_SECRET,
      google: {
        clientId: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      },
      stripe: {
        secretKey: process.env.STRIPE_SECRET_KEY,
        webhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
      },
      getRequestHeaders: expect.any(Function),
    });
    expect(createAuthMock.mock.calls[0]?.[0]).not.toHaveProperty(
      'cookiePrefix'
    );
  });
});

describe('web email test route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.E2E_MOCK_EMAIL;
  });

  it('returns 404 without constructing the email client in non-mock mode', async () => {
    vi.resetModules();
    vi.doMock('@/init', () => ({
      getEmailClient: getEmailClientMock,
    }));

    const { Route } = await import('@/routes/api/test/emails');
    const handlers = Route.options.server?.handlers as
      | {
          GET?: (args: { request: Request }) => Promise<Response>;
        }
      | undefined;
    const handler = handlers?.GET;

    expect(handler).toBeTypeOf('function');

    const response = await handler!({
      request: new Request(
        'http://localhost/api/test/emails?to=user@example.com'
      ),
    });

    expect(response.status).toBe(404);
    expect(getEmailClientMock).not.toHaveBeenCalled();
  });
});
