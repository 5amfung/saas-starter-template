import { describe, expect, it } from 'vitest';
import {
  PERSONAL_WORKSPACE_TYPE,
  STANDARD_WORKSPACE_TYPE,
  buildWorkspaceSlug,
  buildWorkspaceSlugBase,
  isPersonalWorkspace,
} from '@/workspace/workspace';

describe('workspace utilities', () => {
  it('detects personal workspace from first-class fields', () => {
    expect(
      isPersonalWorkspace({
        workspaceType: PERSONAL_WORKSPACE_TYPE,
        personalOwnerUserId: 'user_abc',
      }),
    ).toBe(true);
    expect(
      isPersonalWorkspace({ workspaceType: STANDARD_WORKSPACE_TYPE }),
    ).toBe(false);
  });

  it('builds a safe slug base from workspace names', () => {
    expect(buildWorkspaceSlugBase('My Awesome Workspace!')).toBe(
      'my-awesome-workspace',
    );
    expect(buildWorkspaceSlugBase('   ')).toBe('workspace');
  });

  it('builds unique workspace slugs with random suffix', () => {
    const slug = buildWorkspaceSlug('Project Alpha');
    expect(slug).toMatch(/^project-alpha-[a-z0-9]{6}$/);
  });
});
