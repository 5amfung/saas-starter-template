// @vitest-environment jsdom
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  createMockSessionResponse,
  renderWithProviders,
} from '@workspace/test-utils';
import { Route } from '@/routes/_protected/ws/$workspaceId/members';

const {
  listMembersMock,
  routerInvalidateMock,
  useSessionQueryMock,
  useWorkspaceDetailQueryMock,
  transferWorkspaceOwnershipMock,
  navigateMock,
} = vi.hoisted(() => ({
  listMembersMock: vi.fn(),
  routerInvalidateMock: vi.fn().mockResolvedValue(undefined),
  useSessionQueryMock: vi.fn(),
  useWorkspaceDetailQueryMock: vi.fn(),
  transferWorkspaceOwnershipMock: vi.fn(),
  navigateMock: vi.fn(),
}));

vi.mock('@tanstack/react-router', async (importOriginal) => ({
  ...(await importOriginal()),
  useNavigate: () => navigateMock,
  useRouter: () => ({
    invalidate: routerInvalidateMock,
  }),
}));

vi.mock('@workspace/auth/client', () => ({
  authClient: {
    organization: {
      listMembers: listMembersMock,
    },
  },
}));

vi.mock('@workspace/components/hooks', async (importOriginal) => ({
  ...(await importOriginal()),
  useSessionQuery: useSessionQueryMock,
}));

vi.mock('@/workspace/workspace.queries', () => ({
  useWorkspaceDetailQuery: useWorkspaceDetailQueryMock,
  WORKSPACE_DETAIL_QUERY_KEY: (workspaceId: string) => [
    'workspace',
    'detail',
    workspaceId,
  ],
  WORKSPACE_LIST_QUERY_KEY: ['workspace', 'list'],
}));

vi.mock('@/workspace/workspace-members.functions', () => ({
  leaveWorkspace: vi.fn(),
  removeWorkspaceMember: vi.fn(),
  transferWorkspaceOwnership: transferWorkspaceOwnershipMock,
}));

const mockSession = createMockSessionResponse();

function buildMembersResponse(ownerRole: 'owner' | 'admin') {
  return {
    members: [
      {
        id: 'mem-1',
        userId: 'user-1',
        role: ownerRole,
        user: { email: 'owner@test.com' },
      },
      {
        id: 'mem-2',
        userId: 'user-2',
        role: ownerRole === 'owner' ? 'member' : 'owner',
        user: { email: 'member@test.com' },
      },
    ],
    total: 2,
  };
}

describe('WorkspaceMembersPage integration', () => {
  let loaderData: {
    workspaceRole: 'owner' | 'admin';
    canLeaveWorkspace: boolean;
    canInviteMembers: boolean;
    canManageMembers: boolean;
  };
  let rerenderPage: (() => void) | null = null;
  const MembersPageComponent = Route.options.component!;
  const useParamsMock = vi.spyOn(Route, 'useParams');
  const useLoaderDataMock = vi.spyOn(Route, 'useLoaderData');

  beforeEach(() => {
    vi.clearAllMocks();

    loaderData = {
      workspaceRole: 'owner',
      canLeaveWorkspace: true,
      canInviteMembers: true,
      canManageMembers: true,
    };

    useSessionQueryMock.mockReturnValue({ data: mockSession });
    useWorkspaceDetailQueryMock.mockReturnValue({
      data: { name: 'Acme Workspace' },
    });
    useParamsMock.mockReturnValue({ workspaceId: 'ws-1' } as never);
    useLoaderDataMock.mockImplementation(() => loaderData as never);
    transferWorkspaceOwnershipMock.mockResolvedValue({
      workspaceId: 'ws-1',
      memberId: 'mem-2',
    });

    listMembersMock.mockResolvedValueOnce({
      data: buildMembersResponse('owner'),
      error: null,
    });
    listMembersMock.mockResolvedValueOnce({
      data: buildMembersResponse('admin'),
      error: null,
    });
    listMembersMock.mockResolvedValue({
      data: buildMembersResponse('admin'),
      error: null,
    });

    routerInvalidateMock.mockImplementation(() => {
      loaderData = {
        ...loaderData,
        workspaceRole: 'admin',
        canManageMembers: true,
      };
      rerenderPage?.();
    });
  });

  it('drops owner-only transfer affordances after a successful transfer', async () => {
    const user = userEvent.setup();
    const renderResult = renderWithProviders(<MembersPageComponent />);
    rerenderPage = () => {
      renderResult.rerender(<MembersPageComponent />);
    };

    await waitFor(() => {
      expect(screen.getByText('owner@test.com')).toBeInTheDocument();
      expect(screen.getByText('member@test.com')).toBeInTheDocument();
    });

    await user.click(
      screen.getByRole('button', {
        name: /row actions for member@test\.com/i,
      })
    );
    expect(
      await screen.findByRole('menuitem', { name: /transfer ownership/i })
    ).toBeInTheDocument();

    await user.click(
      screen.getByRole('menuitem', { name: /transfer ownership/i })
    );

    await user.type(screen.getByPlaceholderText('TRANSFER'), 'TRANSFER');
    await user.click(
      screen.getByRole('button', { name: /transfer ownership/i })
    );

    await waitFor(() => {
      expect(transferWorkspaceOwnershipMock).toHaveBeenCalledWith({
        data: {
          workspaceId: 'ws-1',
          memberId: 'mem-2',
        },
      });
    });

    await waitFor(() => {
      expect(routerInvalidateMock).toHaveBeenCalledWith({
        sync: true,
      });
    });

    await waitFor(() => {
      expect(screen.getByText('admin')).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    });

    const memberRow = screen.getByText('member@test.com').closest('tr');
    expect(memberRow).not.toBeNull();

    await user.click(
      within(memberRow!).getByRole('button', {
        name: /row actions for member@test\.com/i,
      })
    );

    expect(
      screen.queryByRole('menuitem', { name: /transfer ownership/i })
    ).not.toBeInTheDocument();
  });
});
