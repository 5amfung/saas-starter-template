describe('admin workspace import safety', () => {
  it('imports the query module without requiring RESEND_API_KEY', async () => {
    const previousApiKey = process.env.RESEND_API_KEY;
    delete process.env.RESEND_API_KEY;

    try {
      vi.resetModules();
      await expect(import('@/admin/workspaces.queries')).resolves.toBeDefined();
    } finally {
      if (previousApiKey === undefined) {
        delete process.env.RESEND_API_KEY;
      } else {
        process.env.RESEND_API_KEY = previousApiKey;
      }
    }
  });
});
