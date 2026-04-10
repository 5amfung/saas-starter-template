describe('integration crypto helpers', () => {
  const TEST_KEY = Buffer.alloc(32, 7).toString('base64');

  beforeEach(() => {
    vi.resetModules();
    process.env.WORKSPACE_SECRET_ENCRYPTION_KEY = TEST_KEY;
  });

  afterEach(() => {
    delete process.env.WORKSPACE_SECRET_ENCRYPTION_KEY;
  });

  it('round-trips encrypted integration secrets', async () => {
    const cryptoModule =
      await import('@/integrations/integration-crypto.server');

    const encrypted = cryptoModule.encryptIntegrationSecret(
      'slack-client-secret'
    );

    expect(encrypted).toEqual(
      expect.objectContaining({
        encryptedValue: expect.any(String),
        iv: expect.any(String),
        authTag: expect.any(String),
        encryptionVersion: 1,
      })
    );
    expect(encrypted.encryptedValue).not.toBe('slack-client-secret');

    expect(
      cryptoModule.decryptIntegrationSecret({
        encryptedValue: encrypted.encryptedValue,
        iv: encrypted.iv,
        authTag: encrypted.authTag,
        encryptionVersion: encrypted.encryptionVersion,
      })
    ).toBe('slack-client-secret');
  });

  it('throws when the encryption key is missing', async () => {
    delete process.env.WORKSPACE_SECRET_ENCRYPTION_KEY;
    const cryptoModule =
      await import('@/integrations/integration-crypto.server');

    expect(() =>
      cryptoModule.encryptIntegrationSecret('slack-client-secret')
    ).toThrow(/WORKSPACE_SECRET_ENCRYPTION_KEY is required/i);
  });

  it('masks secrets for display without exposing the full value', async () => {
    const cryptoModule =
      await import('@/integrations/integration-crypto.server');

    expect(cryptoModule.maskIntegrationSecret('1234567890abcdef')).toBe(
      '123456**********'
    );
    expect(cryptoModule.maskIntegrationSecret('short')).toBe('shor****');
  });
});
