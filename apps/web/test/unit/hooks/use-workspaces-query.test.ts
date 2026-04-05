// @vitest-environment jsdom
import {
  WORKSPACES_QUERY_KEY,
  renameWorkspaceInList,
} from '@/hooks/use-workspaces-query';

describe('useWorkspacesQuery helpers', () => {
  it('exposes a stable workspace list query key', () => {
    expect(WORKSPACES_QUERY_KEY).toEqual(['workspace', 'list']);
  });

  it('renames only the matching workspace in the cached list', () => {
    const workspaces = [
      {
        id: 'ws-1',
        name: 'Workspace One',
        slug: 'workspace-one',
        createdAt: new Date('2026-04-05T00:00:00.000Z'),
      },
      {
        id: 'ws-2',
        name: 'Workspace Two',
        slug: 'workspace-two',
        createdAt: new Date('2026-04-05T00:00:00.000Z'),
      },
    ];

    expect(
      renameWorkspaceInList(workspaces, 'ws-2', 'Renamed Workspace')
    ).toEqual([
      workspaces[0],
      {
        ...workspaces[1],
        name: 'Renamed Workspace',
      },
    ]);
  });

  it('preserves undefined cache data', () => {
    expect(renameWorkspaceInList(undefined, 'ws-1', 'Renamed')).toBeUndefined();
  });
});
