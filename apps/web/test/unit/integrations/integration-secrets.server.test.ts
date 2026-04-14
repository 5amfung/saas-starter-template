import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getWorkspaceIntegrationsSummary,
  revealWorkspaceIntegrationSecretValue,
  updateWorkspaceIntegrationSecretValues,
} from '@/integrations/integration-secrets.server';

const ENCRYPTION_KEY = Buffer.alloc(32, 7).toString('base64');

const {
  getDbMock,
  getWorkspaceIntegrationSummariesMock,
  requireWorkspaceCapabilityForUserMock,
  revealWorkspaceIntegrationValueMock,
  updateWorkspaceIntegrationValuesMock,
} = vi.hoisted(() => ({
  getDbMock: vi.fn(),
  getWorkspaceIntegrationSummariesMock: vi.fn(),
  requireWorkspaceCapabilityForUserMock: vi.fn(),
  revealWorkspaceIntegrationValueMock: vi.fn(),
  updateWorkspaceIntegrationValuesMock: vi.fn(),
}));

vi.mock('@workspace/integrations', () => ({
  getWorkspaceIntegrationSummaries: getWorkspaceIntegrationSummariesMock,
  revealWorkspaceIntegrationValue: revealWorkspaceIntegrationValueMock,
  updateWorkspaceIntegrationValues: updateWorkspaceIntegrationValuesMock,
}));

vi.mock('@/init', () => ({
  getDb: getDbMock,
}));

vi.mock('@/policy/workspace-capabilities.server', () => ({
  requireWorkspaceCapabilityForUser: requireWorkspaceCapabilityForUserMock,
}));

describe('integration secret server adapter', () => {
  const fakeDb = { marker: 'db' };

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.WORKSPACE_SECRET_ENCRYPTION_KEY = ENCRYPTION_KEY;
    getDbMock.mockReturnValue(fakeDb);
    requireWorkspaceCapabilityForUserMock.mockResolvedValue({
      canManageIntegrations: true,
    });
  });

  afterEach(() => {
    delete process.env.WORKSPACE_SECRET_ENCRYPTION_KEY;
    delete process.env.BETTER_AUTH_SECRET;
  });

  it('delegates workspace summary loading after capability checks', async () => {
    getWorkspaceIntegrationSummariesMock.mockResolvedValueOnce([]);

    const result = await getWorkspaceIntegrationsSummary(
      new Headers(),
      'ws-1',
      'user-1'
    );

    expect(requireWorkspaceCapabilityForUserMock).toHaveBeenCalledWith(
      expect.any(Headers),
      'ws-1',
      'user-1',
      'canViewIntegrations'
    );
    expect(getDbMock).toHaveBeenCalledTimes(1);
    expect(getWorkspaceIntegrationSummariesMock).toHaveBeenCalledWith({
      db: fakeDb,
      encryptionKey: ENCRYPTION_KEY,
      includeValues: true,
      workspaceId: 'ws-1',
    });
    expect(result).toEqual([]);
  });

  it('omits plaintext values for viewers without manage capability', async () => {
    requireWorkspaceCapabilityForUserMock.mockResolvedValueOnce({
      canManageIntegrations: false,
    });
    getWorkspaceIntegrationSummariesMock.mockResolvedValueOnce([]);

    await getWorkspaceIntegrationsSummary(new Headers(), 'ws-1', 'user-1');

    expect(getWorkspaceIntegrationSummariesMock).toHaveBeenCalledWith({
      db: fakeDb,
      encryptionKey: ENCRYPTION_KEY,
      includeValues: false,
      workspaceId: 'ws-1',
    });
  });

  it('delegates value reveal after manage capability checks', async () => {
    revealWorkspaceIntegrationValueMock.mockResolvedValueOnce({
      value: 'secret',
    });

    const result = await revealWorkspaceIntegrationSecretValue(
      new Headers(),
      'ws-1',
      'user-1',
      'slack',
      'clientSecret'
    );

    expect(requireWorkspaceCapabilityForUserMock).toHaveBeenCalledWith(
      expect.any(Headers),
      'ws-1',
      'user-1',
      'canManageIntegrations'
    );
    expect(revealWorkspaceIntegrationValueMock).toHaveBeenCalledWith({
      db: fakeDb,
      encryptionKey: ENCRYPTION_KEY,
      workspaceId: 'ws-1',
      integration: 'slack',
      key: 'clientSecret',
    });
    expect(result).toEqual({ value: 'secret' });
  });

  it('delegates update after manage capability checks', async () => {
    updateWorkspaceIntegrationValuesMock.mockResolvedValueOnce([]);

    const result = await updateWorkspaceIntegrationSecretValues(
      new Headers(),
      'ws-1',
      'user-1',
      'slack',
      [{ key: 'clientId', value: 'client-id-1' }]
    );

    expect(requireWorkspaceCapabilityForUserMock).toHaveBeenCalledWith(
      expect.any(Headers),
      'ws-1',
      'user-1',
      'canManageIntegrations'
    );
    expect(updateWorkspaceIntegrationValuesMock).toHaveBeenCalledWith({
      db: fakeDb,
      encryptionKey: ENCRYPTION_KEY,
      workspaceId: 'ws-1',
      integration: 'slack',
      values: [{ key: 'clientId', value: 'client-id-1' }],
    });
    expect(result).toEqual([]);
  });

  it('rejects access before calling package helpers', async () => {
    requireWorkspaceCapabilityForUserMock.mockRejectedValueOnce(
      new Error('forbidden')
    );

    await expect(
      getWorkspaceIntegrationsSummary(new Headers(), 'ws-1', 'user-1')
    ).rejects.toMatchObject({ message: 'forbidden' });

    expect(getWorkspaceIntegrationSummariesMock).not.toHaveBeenCalled();
    expect(getDbMock).not.toHaveBeenCalled();
  });

  it('fails early when the dedicated key is missing', async () => {
    delete process.env.WORKSPACE_SECRET_ENCRYPTION_KEY;

    const error = await updateWorkspaceIntegrationSecretValues(
      new Headers(),
      'ws-1',
      'user-1',
      'slack',
      [{ key: 'clientId', value: 'client-id-1' }]
    ).catch((caught) => caught);

    expect(error).toBeInstanceOf(Error);
    expect(error.message).toMatch(
      /WORKSPACE_SECRET_ENCRYPTION_KEY is required/i
    );
    expect(updateWorkspaceIntegrationValuesMock).not.toHaveBeenCalled();
  });
});
