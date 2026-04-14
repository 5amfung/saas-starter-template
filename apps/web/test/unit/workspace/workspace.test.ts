import {
  pickDefaultWorkspace,
  pickWorkspaceForSwitcher,
} from '@/workspace/workspace';

describe('pickWorkspaceForSwitcher', () => {
  it('returns the matching workspace when activeWorkspaceId is set', () => {
    const workspaces = [{ id: 'ws_1' }, { id: 'ws_2' }];
    expect(pickWorkspaceForSwitcher(workspaces, 'ws_2')?.id).toBe('ws_2');
  });

  it('falls back to the first workspace when there is no active workspace', () => {
    const workspaces = [{ id: 'ws_1' }, { id: 'ws_2' }];
    expect(pickWorkspaceForSwitcher(workspaces, null)?.id).toBe('ws_1');
  });

  it('returns null when no active workspace matches and there is no fallback', () => {
    expect(pickWorkspaceForSwitcher([], 'missing')).toBeNull();
  });
});

describe('pickDefaultWorkspace', () => {
  it('returns null for empty array', () => {
    expect(pickDefaultWorkspace([])).toBeNull();
  });

  it('returns the first workspace', () => {
    const workspaces = [{ id: 'ws_1' }, { id: 'ws_2' }];
    expect(pickDefaultWorkspace(workspaces)?.id).toBe('ws_1');
  });
});
