import { describe, expect, it, vi } from 'vitest';
import * as e2eDb from '../src/e2e-db';
import * as seededUser from '../src/seeded-user';
import * as isolatedWorkspace from '../src/isolated-workspace';

describe('createIsolatedWorkspaceFixture', () => {
  it('returns owner credentials and workspace metadata from a seeded user', async () => {
    vi.spyOn(seededUser, 'createSeededUser').mockResolvedValue({
      userId: 'e2e_user_123',
      workspaceId: 'e2e_org_123',
      cookie: 'better-auth.session_token=fixture123',
    });

    const fixture = await isolatedWorkspace.createIsolatedWorkspaceFixture(
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

  it('seeds a paid plan when requested', async () => {
    vi.spyOn(seededUser, 'createSeededUser').mockResolvedValue({
      userId: 'e2e_user_paid',
      workspaceId: 'e2e_org_paid',
      cookie: 'better-auth.session_token=fixture456',
    });

    const findMany = vi.fn().mockResolvedValue([]);
    const values = vi.fn().mockResolvedValue(undefined);
    const insert = vi.fn().mockReturnValue({ values });

    vi.spyOn(e2eDb, 'getE2EDb').mockReturnValue({
      query: {
        subscription: {
          findMany,
        },
      },
      insert,
    } as never);

    await isolatedWorkspace.createIsolatedWorkspaceFixture(
      'http://localhost:3000',
      {
        owner: {
          email: 'paid-owner@e2e.local',
          password: 'Password123!',
        },
        plan: 'starter',
      }
    );

    expect(findMany).toHaveBeenCalled();
    expect(insert).toHaveBeenCalled();
    expect(values).toHaveBeenCalledWith(
      expect.objectContaining({
        plan: 'starter',
        referenceId: 'e2e_org_paid',
        status: 'active',
      })
    );
  });
});
