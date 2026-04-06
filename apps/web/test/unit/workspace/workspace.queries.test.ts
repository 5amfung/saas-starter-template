// @vitest-environment jsdom
import {
  WORKSPACE_DETAIL_QUERY_KEY,
  WORKSPACE_LIST_QUERY_KEY,
} from '@/workspace/workspace.queries';

describe('workspace query keys', () => {
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
