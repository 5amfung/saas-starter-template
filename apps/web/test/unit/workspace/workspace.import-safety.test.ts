describe('workspace import safety', () => {
  it('imports workspace modules without constructing app services', async () => {
    const previousApiKey = process.env.RESEND_API_KEY;
    delete process.env.RESEND_API_KEY;

    const importFromFreshModuleState = async (modulePath: string) => {
      vi.resetModules();
      await expect(import(modulePath)).resolves.toBeDefined();
    };

    try {
      await importFromFreshModuleState('@/workspace/workspace.functions');
      await importFromFreshModuleState('@/workspace/workspace.queries');
      await importFromFreshModuleState('@/workspace/workspace.queries');
      await importFromFreshModuleState('@/workspace/workspace.functions');
    } finally {
      if (previousApiKey === undefined) {
        delete process.env.RESEND_API_KEY;
      } else {
        process.env.RESEND_API_KEY = previousApiKey;
      }
    }
  });
});
