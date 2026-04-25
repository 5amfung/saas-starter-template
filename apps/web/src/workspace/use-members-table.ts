import * as React from 'react';
import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { useNavigate, useRouter } from '@tanstack/react-router';
import { toast } from 'sonner';
import {
  MEMBER_PAGE_SIZE_DEFAULT,
  withPendingId,
} from './workspace-members.types';
import type { SortingState } from '@tanstack/react-table';
import type { WorkspaceMemberRow } from '@/components/workspace/workspace-members-table';
import {
  OPERATIONS,
  buildWorkflowAttributes,
  workflowLogger,
} from '@/observability/client';
import { authClient } from '@/auth/client/auth-client';
import { useSessionQuery } from '@/hooks';
import {
  WORKSPACE_DETAIL_QUERY_KEY,
  WORKSPACE_LIST_QUERY_KEY,
  useWorkspaceDetailQuery,
} from '@/workspace/workspace.queries';
import {
  leaveWorkspace,
  removeWorkspaceMember,
  transferWorkspaceOwnership,
} from '@/workspace/workspace-members.functions';

const WORKFLOW_ROUTE = 'workspace-members';

function buildWorkspaceMembershipAttributes(
  operation: (typeof OPERATIONS)[keyof typeof OPERATIONS],
  result: 'attempt' | 'success' | 'failure',
  workspaceId: string,
  currentUserId: string | null,
  failureCategory?: string,
  targetUserId?: string
) {
  return buildWorkflowAttributes(operation, {
    route: WORKFLOW_ROUTE,
    workspaceId,
    userId: currentUserId ?? undefined,
    targetUserId,
    result,
    ...(failureCategory ? { failureCategory } : {}),
  });
}

export function useMembersTable(
  workspaceId: string,
  currentUserRole: string | null,
  canLeaveWorkspace = false
) {
  const navigate = useNavigate();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: session } = useSessionQuery();
  const { data: workspace } = useWorkspaceDetailQuery(workspaceId);
  const currentUserId = session?.user.id ?? null;

  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(MEMBER_PAGE_SIZE_DEFAULT);
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [removingMemberId, setRemovingMemberId] = React.useState<string | null>(
    null
  );
  const [transferringMemberId, setTransferringMemberId] = React.useState<
    string | null
  >(null);

  React.useEffect(() => {
    setPage(1);
  }, [pageSize, sorting]);

  const sortBy = sorting[0]?.id;
  const sortDirection = sorting[0]?.desc ? ('desc' as const) : ('asc' as const);
  const shouldSortEmailClientSide = sortBy === 'email';

  const membersQuery = useQuery({
    queryKey: [
      'workspace',
      'members',
      workspaceId,
      page,
      pageSize,
      sortBy,
      sorting[0]?.desc ?? false,
    ],
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const { data, error } = await authClient.organization.listMembers({
        query: {
          organizationId: workspaceId,
          limit: pageSize,
          offset: (page - 1) * pageSize,
          ...(sortBy && !shouldSortEmailClientSide
            ? { sortBy, sortDirection }
            : {}),
        },
      });

      if (error) throw new Error(error.message);

      const members = data.members
        .map((member) => ({
          id: member.id,
          userId: member.userId,
          role: member.role,
          email: member.user.email,
        }))
        .sort((left, right) => {
          if (!shouldSortEmailClientSide) return 0;

          const comparison = left.email.localeCompare(right.email);
          return sortDirection === 'desc' ? comparison * -1 : comparison;
        });

      return {
        members,
        total: data.total,
        totalPages: Math.max(1, Math.ceil(data.total / pageSize)),
      };
    },
  });

  const leaveMutation = useMutation({
    mutationFn: async () => {
      await leaveWorkspace({
        data: {
          workspaceId,
        },
      });
    },
    onSuccess: () => {
      toast.success('You have left the workspace.');
      void navigate({ to: '/ws' });
      workflowLogger.info(
        'Workspace left',
        buildWorkspaceMembershipAttributes(
          OPERATIONS.WORKSPACE_MEMBER_LEAVE,
          'success',
          workspaceId,
          currentUserId
        )
      );
    },
    onError: (error) => {
      workflowLogger.error(
        'Workspace leave failed',
        buildWorkspaceMembershipAttributes(
          OPERATIONS.WORKSPACE_MEMBER_LEAVE,
          'failure',
          workspaceId,
          currentUserId,
          'leave_failed'
        )
      );
      toast.error(error.message || 'Failed to leave workspace.');
    },
  });

  const removeMemberMutation = useMutation({
    mutationFn: async (memberId: string) => {
      await removeWorkspaceMember({
        data: {
          workspaceId,
          memberId,
        },
      });
    },
    onSuccess: async () => {
      toast.success('Membership removed.');
      await membersQuery.refetch();
      workflowLogger.info(
        'Workspace member removed',
        buildWorkspaceMembershipAttributes(
          OPERATIONS.WORKSPACE_MEMBER_REMOVE,
          'success',
          workspaceId,
          currentUserId
        )
      );
    },
    onError: (error) => {
      workflowLogger.error(
        'Workspace member removal failed',
        buildWorkspaceMembershipAttributes(
          OPERATIONS.WORKSPACE_MEMBER_REMOVE,
          'failure',
          workspaceId,
          currentUserId,
          'removal_failed'
        )
      );
      toast.error(error.message || 'Failed to remove membership.');
    },
  });

  const transferOwnershipMutation = useMutation({
    mutationFn: async (memberId: string) => {
      await transferWorkspaceOwnership({
        data: {
          workspaceId,
          memberId,
        },
      });
    },
    onSuccess: async () => {
      toast.success('Workspace ownership transferred successfully.');
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: WORKSPACE_LIST_QUERY_KEY }),
        queryClient.invalidateQueries({
          queryKey: WORKSPACE_DETAIL_QUERY_KEY(workspaceId),
        }),
        queryClient.invalidateQueries({
          queryKey: ['workspace', 'members', workspaceId],
        }),
        router.invalidate({ sync: true }),
      ]);
      await membersQuery.refetch();
      workflowLogger.info(
        'Workspace ownership transferred',
        buildWorkspaceMembershipAttributes(
          OPERATIONS.WORKSPACE_TRANSFER_OWNERSHIP,
          'success',
          workspaceId,
          currentUserId
        )
      );
    },
    onError: (error) => {
      workflowLogger.error(
        'Workspace ownership transfer failed',
        buildWorkspaceMembershipAttributes(
          OPERATIONS.WORKSPACE_TRANSFER_OWNERSHIP,
          'failure',
          workspaceId,
          currentUserId,
          'transfer_failed'
        )
      );
      toast.error(error.message || 'Failed to transfer workspace ownership.');
    },
  });

  const members = membersQuery.data?.members ?? [];
  const total = membersQuery.data?.total ?? 0;
  const totalPages = membersQuery.data?.totalPages ?? 1;

  return {
    currentUserId,
    currentUserRole,
    canLeaveWorkspace,
    workspaceName: workspace?.name ?? workspaceId,
    data: members satisfies Array<WorkspaceMemberRow>,
    total,
    page,
    pageSize,
    totalPages,
    sorting,
    isLoading: membersQuery.isPending && !membersQuery.data,
    removingMemberId,
    transferringMemberId,
    leavingWorkspace: leaveMutation.isPending,
    onSortingChange: setSorting,
    onPageChange: setPage,
    onPageSizeChange: setPageSize,
    onRemoveMember: async (memberId: string) => {
      try {
        await withPendingId(setRemovingMemberId, memberId, async () => {
          await removeMemberMutation.mutateAsync(memberId);
        });
      } catch {
        return;
      }
    },
    onTransferOwnership: async (memberId: string) => {
      try {
        await withPendingId(setTransferringMemberId, memberId, async () => {
          await transferOwnershipMutation.mutateAsync(memberId);
        });
      } catch {
        return;
      }
    },
    onLeave: async () => {
      await leaveMutation.mutateAsync();
    },
  };
}
