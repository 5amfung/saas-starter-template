import { verifyWorkspaceApiKey } from '@/api/api-key-verification.server';

const { getAuthMock, verifyApiKeyMock } = vi.hoisted(() => ({
  getAuthMock: vi.fn(),
  verifyApiKeyMock: vi.fn(),
}));

vi.mock('@/init.server', () => ({
  getAuth: getAuthMock,
}));

describe('api-key-verification.server', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getAuthMock.mockReturnValue({
      api: {
        verifyApiKey: verifyApiKeyMock,
      },
    });
  });

  it('returns missing-key when the api key header is missing', async () => {
    await expect(
      verifyWorkspaceApiKey({
        apiKey: null,
        workspaceId: 'ws_1',
      })
    ).resolves.toEqual({
      ok: false,
      reason: 'missing-key',
    });

    expect(verifyApiKeyMock).not.toHaveBeenCalled();
  });

  it('returns missing-workspace when the workspace header is blank', async () => {
    await expect(
      verifyWorkspaceApiKey({
        apiKey: 'sr_secret',
        workspaceId: '   ',
      })
    ).resolves.toEqual({
      ok: false,
      reason: 'missing-workspace',
    });

    expect(verifyApiKeyMock).not.toHaveBeenCalled();
  });

  it('returns invalid-key when verification fails', async () => {
    verifyApiKeyMock.mockResolvedValueOnce({
      valid: false,
      error: { code: 'INVALID_API_KEY', message: 'Invalid API key' },
      key: null,
    });

    await expect(
      verifyWorkspaceApiKey({
        apiKey: 'sr_secret',
        workspaceId: 'ws_1',
      })
    ).resolves.toEqual({
      ok: false,
      reason: 'invalid-key',
    });

    expect(verifyApiKeyMock).toHaveBeenCalledWith({
      body: {
        configId: 'system-managed',
        key: 'sr_secret',
      },
    });
  });

  it('returns rate-limited when Better Auth rejects with a rate limit error', async () => {
    verifyApiKeyMock.mockRejectedValueOnce({
      status: 'UNAUTHORIZED',
      body: {
        message: 'Rate limit exceeded.',
        code: 'RATE_LIMITED',
        details: { tryAgainIn: 1250 },
      },
      statusCode: 401,
    });

    await expect(
      verifyWorkspaceApiKey({
        apiKey: 'sr_secret',
        workspaceId: 'ws_1',
      })
    ).resolves.toEqual({
      ok: false,
      reason: 'rate-limited',
      retryAfterSeconds: 2,
    });
  });

  it('returns invalid-key when verification succeeds without a key payload', async () => {
    verifyApiKeyMock.mockResolvedValueOnce({
      valid: true,
      error: null,
      key: null,
    });

    await expect(
      verifyWorkspaceApiKey({
        apiKey: 'sr_secret',
        workspaceId: 'ws_1',
      })
    ).resolves.toEqual({
      ok: false,
      reason: 'invalid-key',
    });
  });

  it('returns forbidden when the verified key belongs to another workspace', async () => {
    verifyApiKeyMock.mockResolvedValueOnce({
      valid: true,
      error: null,
      key: {
        id: 'key_1',
        referenceId: 'ws_other',
      },
    });

    await expect(
      verifyWorkspaceApiKey({
        apiKey: 'sr_secret',
        workspaceId: 'ws_1',
      })
    ).resolves.toEqual({
      ok: false,
      reason: 'forbidden',
      keyId: 'key_1',
    });
  });

  it('returns success when the verified key matches the requested workspace', async () => {
    verifyApiKeyMock.mockResolvedValueOnce({
      valid: true,
      error: null,
      key: {
        id: 'key_1',
        referenceId: 'ws_1',
      },
    });

    await expect(
      verifyWorkspaceApiKey({
        apiKey: 'sr_secret',
        workspaceId: 'ws_1',
      })
    ).resolves.toEqual({
      ok: true,
      keyId: 'key_1',
      workspaceId: 'ws_1',
    });
  });
});
