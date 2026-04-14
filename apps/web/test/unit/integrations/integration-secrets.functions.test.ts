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
        return (input: { data: unknown }) => {
          const data = validator ? validator.parse(input.data) : input.data;
          return Promise.resolve(fn({ data }));
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

  it('rejects invalid reveal key combinations at the input layer', () => {
    let thrownError: unknown;

    expect(() => {
      revealWorkspaceIntegrationValue({
        data: {
          workspaceId: 'ws-1',
          integration: 'slack',
          key: 'botToken',
        },
      });
    }).toThrow();

    try {
      revealWorkspaceIntegrationValue({
        data: {
          workspaceId: 'ws-1',
          integration: 'slack',
          key: 'botToken',
        },
      });
    } catch (error) {
      thrownError = error;
    }

    expect(thrownError).toMatchObject({ name: 'ZodError' });

    expect(revealWorkspaceIntegrationSecretValueMock).not.toHaveBeenCalled();
  });

  it('rejects invalid update keys before reaching the server helper', () => {
    let thrownError: unknown;

    expect(() => {
      updateWorkspaceIntegrationValues({
        data: {
          workspaceId: 'ws-1',
          integration: 'slack',
          values: [{ key: 'botToken', value: 'secret' }],
        },
      });
    }).toThrow();

    try {
      updateWorkspaceIntegrationValues({
        data: {
          workspaceId: 'ws-1',
          integration: 'slack',
          values: [{ key: 'botToken', value: 'secret' }],
        },
      });
    } catch (error) {
      thrownError = error;
    }

    expect(thrownError).toMatchObject({ name: 'ZodError' });

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
