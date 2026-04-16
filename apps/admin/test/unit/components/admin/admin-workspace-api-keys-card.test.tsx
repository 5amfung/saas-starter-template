// @vitest-environment jsdom
import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import { renderWithProviders } from '@workspace/test-utils';
import { AdminWorkspaceApiKeysCard } from '@/components/admin/admin-workspace-api-keys-card';

const { writeTextMock, generatedKeyDialogProps } = vi.hoisted(() => ({
  writeTextMock: vi.fn(),
  generatedKeyDialogProps: {
    current: null as null | {
      workspaceId: string;
      onKeyCreated: (apiKey: {
        id: string;
        key: string;
        start: string | null;
        prefix: string | null;
      }) => void;
    },
  },
}));

vi.mock('@/components/admin/admin-generate-workspace-api-key-dialog', () => ({
  AdminGenerateWorkspaceApiKeyDialog: (props: {
    workspaceId: string;
    onKeyCreated: (apiKey: {
      id: string;
      key: string;
      start: string | null;
      prefix: string | null;
    }) => void;
  }) => {
    generatedKeyDialogProps.current = props;

    return <button type="button">Generate new key</button>;
  },
}));

vi.mock('@/components/admin/admin-delete-workspace-api-key-dialog', () => ({
  AdminDeleteWorkspaceApiKeyDialog: () => <button type="button">Delete</button>,
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal('navigator', {
    ...navigator,
    clipboard: {
      writeText: writeTextMock,
    },
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('AdminWorkspaceApiKeysCard', () => {
  it('renders workspace-owned api key rows without table headers', () => {
    renderWithProviders(
      <AdminWorkspaceApiKeysCard
        workspaceId="ws-1"
        apiKeys={[
          {
            id: 'key-1',
            name: 'Read API Key',
            start: 'abcd',
            prefix: 'r_',
            configId: 'system-managed',
            createdAt: '2026-04-15T00:00:00.000Z',
          },
        ]}
      />
    );

    expect(screen.getByText('API Keys')).toBeInTheDocument();
    expect(screen.getByText('Read API Key')).toBeInTheDocument();
    expect(screen.getByText('system-managed')).toBeInTheDocument();
    expect(screen.getByText(/abcd\*{6}/i)).toBeInTheDocument();
    expect(screen.queryByRole('columnheader')).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /copy api key for read api key/i })
    ).not.toBeInTheDocument();
  });

  it('shows the empty state when no api keys exist', () => {
    renderWithProviders(
      <AdminWorkspaceApiKeysCard workspaceId="ws-1" apiKeys={[]} />
    );

    expect(
      screen.getByText(/no workspace-owned api keys yet/i)
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /generate new key/i })
    ).toBeInTheDocument();
  });

  it('copies the one-time generated plaintext key to the clipboard', async () => {
    writeTextMock.mockResolvedValueOnce(undefined);

    renderWithProviders(
      <AdminWorkspaceApiKeysCard
        workspaceId="ws-1"
        apiKeys={[
          {
            id: 'key-1',
            name: 'Read API Key',
            start: 'abcd',
            prefix: 'r_',
            configId: 'system-managed',
            createdAt: '2026-04-15T00:00:00.000Z',
          },
        ]}
      />
    );

    act(() => {
      generatedKeyDialogProps.current?.onKeyCreated({
        id: 'key-2',
        key: 'r_secret_123',
        start: 'secret',
        prefix: 'r_',
      });
    });

    fireEvent.click(
      screen.getByRole('button', { name: /copy generated api key/i })
    );

    await waitFor(() => {
      expect(writeTextMock).toHaveBeenCalledWith('r_secret_123');
    });
  });
});
