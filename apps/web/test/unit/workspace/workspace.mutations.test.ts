// @vitest-environment jsdom
import { WORKSPACE_LIST_QUERY_KEY } from '@/workspace/workspace.queries';
import { renameWorkspaceInList } from '@/workspace/workspace.mutations';

describe('workspace mutation cache helpers', () => {
  it('renames only the matching workspace in cached list data', () => {
    const input = [
      { id: 'ws-1', name: 'One' },
      { id: 'ws-2', name: 'Two' },
    ];

    expect(renameWorkspaceInList(input, 'ws-2', 'Renamed')).toEqual([
      { id: 'ws-1', name: 'One' },
      { id: 'ws-2', name: 'Renamed' },
    ]);
  });

  it('keeps the canonical list key available to mutation contracts', () => {
    expect(WORKSPACE_LIST_QUERY_KEY).toEqual(['workspace', 'list']);
  });
});
