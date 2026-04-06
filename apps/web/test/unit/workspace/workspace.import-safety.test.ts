describe('workspace import safety', () => {
  it('imports the workspace server module without constructing app services', async () => {
    const previousApiKey = process.env.RESEND_API_KEY;
    delete process.env.RESEND_API_KEY;

    try {
      vi.resetModules();
      await expect(
        import('@/workspace/workspace.server')
      ).resolves.toBeDefined();
    } finally {
      if (previousApiKey === undefined) {
        delete process.env.RESEND_API_KEY;
      } else {
        process.env.RESEND_API_KEY = previousApiKey;
      }
    }
  });
});
