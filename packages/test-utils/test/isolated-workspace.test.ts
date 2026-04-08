import { describe, expect, it, vi } from 'vitest';
import { createIsolatedWorkspaceFixture } from '../src/index';
import * as seededUser from '../src/seeded-user';

describe('createIsolatedWorkspaceFixture', () => {
  it('returns owner credentials and workspace metadata from a seeded user', async () => {
    vi.spyOn(seededUser, 'createSeededUser').mockResolvedValue({
      userId: 'e2e_user_123',
      workspaceId: 'e2e_org_123',
      cookie: 'better-auth.session_token=fixture123',
    });

    const fixture = await createIsolatedWorkspaceFixture(
      'http://localhost:3000',
      {
        owner: {
          email: 'owner@e2e.local',
          password: 'Password123!',
          name: 'Fixture Owner',
        },
      }
    );

    expect(seededUser.createSeededUser).toHaveBeenCalledWith(
      'http://localhost:3000',
      {
        email: 'owner@e2e.local',
        password: 'Password123!',
        name: 'Fixture Owner',
      }
    );
    expect(fixture).toMatchObject({
      workspaceId: 'e2e_org_123',
      workspace: {
        id: 'e2e_org_123',
      },
      owner: {
        userId: 'e2e_user_123',
        email: 'owner@e2e.local',
        password: 'Password123!',
        cookie: 'better-auth.session_token=fixture123',
      },
    });
  });
});
