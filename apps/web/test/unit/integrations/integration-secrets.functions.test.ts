import { createMockSessionResponse } from '@workspace/test-utils';
import {
  getWorkspaceIntegrations,
  revealWorkspaceIntegrationValue,
  updateWorkspaceIntegrationValues,
} from '@/integrations/integration-secrets.functions';

const {
  getAuthMock,
  getRequestHeadersMock,
  getWorkspaceIntegrationsSummaryMock,
  revealWorkspaceIntegrationSecretValueMock,
  updateWorkspaceIntegrationSecretValuesMock,
} = vi.hoisted(() => ({
  getAuthMock: vi.fn(),
  getRequestHeadersMock: vi.fn().mockReturnValue(new Headers()),
  getWorkspaceIntegrationsSummaryMock: vi.fn(),
  revealWorkspaceIntegrationSecretValueMock: vi.fn(),
  updateWorkspaceIntegrationSecretValuesMock: vi.fn(),
}));

vi.mock('@tanstack/react-start', () => ({
  createServerFn: () => {
    let validator: { parse: (value: unknown) => unknown } | undefined;

    const builder = {
      inputValidator(nextValidator: { parse: (value: unknown) => unknown }) {
        validator = nextValidator;
        return builder;
      },
      handler(fn: (input: { data: unknown }) => unknown) {
        return async (input: { data: unknown }) => {
          const data = validator ? validator.parse(input.data) : input.data;
          return fn({ data });
        };
      },
    };

    return builder;
  },
}));

vi.mock('@tanstack/react-start/server', () => ({
  getRequestHeaders: getRequestHeadersMock,
}));

vi.mock('@tanstack/react-router', () => ({
  redirect: vi.fn((opts: unknown) => {
    throw opts;
  }),
}));

vi.mock('@/init', () => ({
  getAuth: getAuthMock,
}));

vi.mock('@/integrations/integration-secrets.server', () => ({
  getWorkspaceIntegrationsSummary: getWorkspaceIntegrationsSummaryMock,
  revealWorkspaceIntegrationSecretValue:
    revealWorkspaceIntegrationSecretValueMock,
  updateWorkspaceIntegrationSecretValues:
    updateWorkspaceIntegrationSecretValuesMock,
}));

describe('integration secret server functions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getAuthMock.mockReturnValue({
      api: {
        getSession: vi.fn().mockResolvedValue(createMockSessionResponse()),
      },
    });
  });

  it('passes valid reveal input to the server helper', async () => {
    revealWorkspaceIntegrationSecretValueMock.mockResolvedValueOnce({
      value: 'secret',
    });

    const result = await revealWorkspaceIntegrationValue({
      data: {
        workspaceId: 'ws-1',
        integration: 'slack',
        key: 'clientSecret',
      },
    });

    expect(revealWorkspaceIntegrationSecretValueMock).toHaveBeenCalledWith(
      expect.any(Headers),
      'ws-1',
      expect.any(String),
      'slack',
      'clientSecret'
    );
    expect(result).toEqual({ value: 'secret' });
  });

  it('rejects invalid reveal key combinations at the input layer', async () => {
    await expect(
      revealWorkspaceIntegrationValue({
        data: {
          workspaceId: 'ws-1',
          integration: 'slack',
          key: 'botToken',
        },
      })
    ).rejects.toMatchObject({
      name: 'ZodError',
    });

    expect(revealWorkspaceIntegrationSecretValueMock).not.toHaveBeenCalled();
  });

  it('rejects invalid update keys before reaching the server helper', async () => {
    await expect(
      updateWorkspaceIntegrationValues({
        data: {
          workspaceId: 'ws-1',
          integration: 'slack',
          values: [{ key: 'botToken', value: 'secret' }],
        },
      })
    ).rejects.toMatchObject({
      name: 'ZodError',
    });

    expect(updateWorkspaceIntegrationSecretValuesMock).not.toHaveBeenCalled();
  });

  it('passes valid summary input through', async () => {
    getWorkspaceIntegrationsSummaryMock.mockResolvedValueOnce([]);

    await getWorkspaceIntegrations({
      data: {
        workspaceId: 'ws-1',
      },
    });

    expect(getWorkspaceIntegrationsSummaryMock).toHaveBeenCalledWith(
      expect.any(Headers),
      'ws-1',
      expect.any(String)
    );
  });
});
