import {
  ADMIN_WORKSPACE_DETAIL_QUERY_KEY,
  adminWorkspaceListQueryKey,
} from '@/admin/workspaces.queries';

describe('admin workspace query keys', () => {
  it('builds a stable list key from admin workspace filters', () => {
    expect(
      adminWorkspaceListQueryKey({
        page: 2,
        pageSize: 25,
        search: 'acme',
        filter: 'enterprise',
        sortBy: 'name',
        sortDirection: 'asc',
      })
    ).toEqual([
      'admin',
      'workspaces',
      2,
      25,
      'acme',
      'enterprise',
      'name',
      'asc',
    ]);
  });

  it('builds a stable detail key', () => {
    expect(ADMIN_WORKSPACE_DETAIL_QUERY_KEY('ws-1')).toEqual([
      'admin',
      'workspace',
      'ws-1',
    ]);
  });
});
