// @vitest-environment jsdom
import {
  WORKSPACE_DETAIL_QUERY_KEY,
  WORKSPACE_LIST_QUERY_KEY,
} from '@/workspace/workspace.queries';

describe('workspace query keys', () => {
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

  it('builds a stable list key', () => {
    expect(WORKSPACE_LIST_QUERY_KEY).toEqual(['workspace', 'list']);
  });

  it('builds a stable detail key', () => {
    expect(WORKSPACE_DETAIL_QUERY_KEY('ws-1')).toEqual([
      'workspace',
      'detail',
      'ws-1',
    ]);
  });
});
