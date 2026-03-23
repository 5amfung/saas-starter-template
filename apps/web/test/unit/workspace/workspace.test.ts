import {
  PERSONAL_WORKSPACE_TYPE,
  STANDARD_WORKSPACE_TYPE,
  buildPersonalWorkspaceSlug,
  buildWorkspaceSlug,
  buildWorkspaceSlugBase,
  isPersonalWorkspace,
  isPersonalWorkspaceOwnedByUser,
  pickDefaultWorkspace,
} from '@/workspace/workspace';

describe('workspace utilities', () => {
  it('detects personal workspace from first-class fields', () => {
    expect(
      isPersonalWorkspace({
        workspaceType: PERSONAL_WORKSPACE_TYPE,
        personalOwnerUserId: 'user_abc',
      })
    ).toBe(true);
    expect(
      isPersonalWorkspace({ workspaceType: STANDARD_WORKSPACE_TYPE })
    ).toBe(false);
  });

  it('builds a safe slug base from workspace names', () => {
    expect(buildWorkspaceSlugBase('My Awesome Workspace!')).toBe(
      'my-awesome-workspace'
    );
    expect(buildWorkspaceSlugBase('   ')).toBe('workspace');
  });

  it('builds unique workspace slugs with random suffix', () => {
    const slug = buildWorkspaceSlug('Project Alpha');
    expect(slug).toMatch(/^project-alpha-[a-z0-9]{6}$/);
  });
});

describe('isPersonalWorkspaceOwnedByUser', () => {
  it('returns true for matching personal workspace and user', () => {
    expect(
      isPersonalWorkspaceOwnedByUser(
        { workspaceType: 'personal', personalOwnerUserId: 'user_1' },
        'user_1'
      )
    ).toBe(true);
  });

  it('returns false for different user', () => {
    expect(
      isPersonalWorkspaceOwnedByUser(
        { workspaceType: 'personal', personalOwnerUserId: 'user_1' },
        'user_2'
      )
    ).toBe(false);
  });

  it('returns false for non-personal workspace', () => {
    expect(
      isPersonalWorkspaceOwnedByUser({ workspaceType: 'workspace' }, 'user_1')
    ).toBe(false);
  });

  it('returns false for non-object input', () => {
    expect(isPersonalWorkspaceOwnedByUser(null, 'user_1')).toBe(false);
    expect(isPersonalWorkspaceOwnedByUser('string', 'user_1')).toBe(false);
  });
});

describe('pickDefaultWorkspace', () => {
  it('returns null for empty array', () => {
    expect(pickDefaultWorkspace([], 'user_1')).toBeNull();
  });

  it('picks the personal workspace owned by user', () => {
    const workspaces = [
      { id: 'ws_1', workspaceType: 'workspace' },
      { id: 'ws_2', workspaceType: 'personal', personalOwnerUserId: 'user_1' },
    ];
    expect(pickDefaultWorkspace(workspaces, 'user_1')?.id).toBe('ws_2');
  });

  it('falls back to first workspace if no personal match', () => {
    const workspaces = [
      { id: 'ws_1', workspaceType: 'workspace' },
      { id: 'ws_2', workspaceType: 'workspace' },
    ];
    expect(pickDefaultWorkspace(workspaces, 'user_1')?.id).toBe('ws_1');
  });
});

describe('buildPersonalWorkspaceSlug', () => {
  it('creates slug from user ID', () => {
    expect(buildPersonalWorkspaceSlug('USER_ABC')).toBe('personal-user_abc');
  });

  it('lowercases the user ID', () => {
    expect(buildPersonalWorkspaceSlug('XyZ')).toBe('personal-xyz');
  });
});

describe('edge cases', () => {
  it('generates slug from workspace name with special characters', () => {
    const slug = buildWorkspaceSlug('My Workspace! @#$%');
    expect(slug).toMatch(/^[a-z0-9-]+$/);
  });

  it('buildWorkspaceSlugBase strips all non-alphanumeric characters', () => {
    expect(buildWorkspaceSlugBase('!!!@@@###')).toBe('workspace');
  });

  it('buildWorkspaceSlugBase truncates long names', () => {
    const longName = 'a'.repeat(100);
    const slug = buildWorkspaceSlugBase(longName);
    expect(slug.length).toBeLessThanOrEqual(40);
  });

  it('buildWorkspaceSlugBase collapses multiple hyphens', () => {
    expect(buildWorkspaceSlugBase('hello---world')).toBe('hello-world');
  });

  it('buildWorkspaceSlug produces unique slugs for the same name', () => {
    const slug1 = buildWorkspaceSlug('Test');
    const slug2 = buildWorkspaceSlug('Test');
    expect(slug1).not.toBe(slug2);
  });

  it('isPersonalWorkspaceOwnedByUser handles null personalOwnerUserId', () => {
    const result = isPersonalWorkspaceOwnedByUser(
      {
        workspaceType: 'personal',
        personalOwnerUserId: null,
      } as unknown as Record<string, unknown>,
      'user-1'
    );
    expect(result).toBe(false);
  });

  it('isPersonalWorkspaceOwnedByUser handles undefined workspace fields', () => {
    expect(isPersonalWorkspaceOwnedByUser({}, 'user-1')).toBe(false);
    expect(isPersonalWorkspaceOwnedByUser(undefined, 'user-1')).toBe(false);
  });

  it('pickDefaultWorkspace skips personal workspace owned by different user', () => {
    const workspaces = [
      { id: 'ws_1', workspaceType: 'personal', personalOwnerUserId: 'other' },
      { id: 'ws_2', workspaceType: 'workspace' },
    ];
    const result = pickDefaultWorkspace(workspaces, 'user-1');
    expect(result?.id).toBe('ws_1');
  });

  it('pickDefaultWorkspace returns single workspace when only one exists', () => {
    const workspaces = [{ id: 'ws_only', workspaceType: 'workspace' }];
    expect(pickDefaultWorkspace(workspaces, 'user-1')?.id).toBe('ws_only');
  });

  it('buildPersonalWorkspaceSlug handles empty user ID', () => {
    expect(buildPersonalWorkspaceSlug('')).toBe('personal-');
  });
});
