import {
  buildWorkspaceSlug,
  buildWorkspaceSlugBase,
  pickDefaultWorkspace,
} from '@/workspace/workspace';

describe('workspace utilities', () => {
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

describe('pickDefaultWorkspace', () => {
  it('returns null for empty array', () => {
    expect(pickDefaultWorkspace([])).toBeNull();
  });

  it('returns the first workspace', () => {
    const workspaces = [{ id: 'ws_1' }, { id: 'ws_2' }];
    expect(pickDefaultWorkspace(workspaces)?.id).toBe('ws_1');
  });

  it('returns single workspace when only one exists', () => {
    const workspaces = [{ id: 'ws_only' }];
    expect(pickDefaultWorkspace(workspaces)?.id).toBe('ws_only');
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
});
