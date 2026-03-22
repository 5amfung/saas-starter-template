import {
  PERSONAL_WORKSPACE_NAME,
  PERSONAL_WORKSPACE_TYPE,
  STANDARD_WORKSPACE_TYPE,
  WORKSPACE_TYPES,
  buildPersonalWorkspaceSlug,
  isPersonalWorkspace,
  isPersonalWorkspaceOwnedByUser,
} from '../../src/workspace-types';

describe('workspace-types constants', () => {
  it('exports expected constant values', () => {
    expect(PERSONAL_WORKSPACE_TYPE).toBe('personal');
    expect(STANDARD_WORKSPACE_TYPE).toBe('workspace');
    expect(PERSONAL_WORKSPACE_NAME).toBe('Personal');
    expect(WORKSPACE_TYPES).toEqual(['personal', 'workspace']);
  });
});

describe('isPersonalWorkspace', () => {
  it('returns false for null', () => {
    expect(isPersonalWorkspace(null)).toBe(false);
  });

  it('returns false for undefined', () => {
    expect(isPersonalWorkspace(undefined)).toBe(false);
  });

  it('returns false for non-object primitive', () => {
    expect(isPersonalWorkspace('string')).toBe(false);
  });

  it('returns false for empty object', () => {
    expect(isPersonalWorkspace({})).toBe(false);
  });

  it('returns false for standard workspace type', () => {
    expect(isPersonalWorkspace({ workspaceType: 'workspace' })).toBe(false);
  });

  it('returns true for personal workspace type', () => {
    expect(isPersonalWorkspace({ workspaceType: 'personal' })).toBe(true);
  });
});

describe('isPersonalWorkspaceOwnedByUser', () => {
  it('returns false for null workspace', () => {
    expect(isPersonalWorkspaceOwnedByUser(null, 'u1')).toBe(false);
  });

  it('returns false for non-personal workspace', () => {
    expect(
      isPersonalWorkspaceOwnedByUser({ workspaceType: 'workspace' }, 'u1')
    ).toBe(false);
  });

  it('returns false when personalOwnerUserId does not match', () => {
    expect(
      isPersonalWorkspaceOwnedByUser(
        { workspaceType: 'personal', personalOwnerUserId: 'u2' },
        'u1'
      )
    ).toBe(false);
  });

  it('returns true when personal workspace owned by given user', () => {
    expect(
      isPersonalWorkspaceOwnedByUser(
        { workspaceType: 'personal', personalOwnerUserId: 'u1' },
        'u1'
      )
    ).toBe(true);
  });
});

describe('buildPersonalWorkspaceSlug', () => {
  it('lowercases the userId', () => {
    expect(buildPersonalWorkspaceSlug('ABC')).toBe('personal-abc');
  });

  it('passes through already-lowercase userId', () => {
    expect(buildPersonalWorkspaceSlug('abc')).toBe('personal-abc');
  });

  it('handles mixed case', () => {
    expect(buildPersonalWorkspaceSlug('User123')).toBe('personal-user123');
  });
});
