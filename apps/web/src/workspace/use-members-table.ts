import * as React from 'react';
import { keepPreviousData, useMutation, useQuery } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { toast } from 'sonner';
import { authClient } from '@workspace/auth/client';
import { useSessionQuery } from '@workspace/components/hooks';
import {
  MEMBER_PAGE_SIZE_DEFAULT,
  withPendingId,
} from './workspace-members.types';
import type { SortingState } from '@tanstack/react-table';
import type { WorkspaceMemberRow } from '@/components/workspace/workspace-members-table';
import { useActiveMemberRoleQuery } from '@/hooks/use-active-member-role-query';

export function useMembersTable(workspaceId: string) {
  const navigate = useNavigate();
  const { data: session } = useSessionQuery();
  const currentUserId = session?.user.id ?? null;

  const { data: currentUserRole = null } =
    useActiveMemberRoleQuery(workspaceId);

  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(MEMBER_PAGE_SIZE_DEFAULT);
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [removingMemberId, setRemovingMemberId] = React.useState<string | null>(
    null
  );

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
      const { error } = await authClient.organization.leave({
        organizationId: workspaceId,
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      toast.success('You have left the workspace.');
      void navigate({ to: '/ws' });
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to leave workspace.');
    },
  });

  const removeMemberMutation = useMutation({
    mutationFn: async (memberId: string) => {
      const { error } = await authClient.organization.removeMember({
        memberIdOrEmail: memberId,
        organizationId: workspaceId,
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: async () => {
      toast.success('Membership removed.');
      await membersQuery.refetch();
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to remove membership.');
    },
  });

  const members = membersQuery.data?.members ?? [];
  const total = membersQuery.data?.total ?? 0;
  const totalPages = membersQuery.data?.totalPages ?? 1;

  return {
    currentUserId,
    currentUserRole,
    data: members satisfies Array<WorkspaceMemberRow>,
    total,
    page,
    pageSize,
    totalPages,
    sorting,
    isLoading: membersQuery.isPending && !membersQuery.data,
    removingMemberId,
    leavingWorkspace: leaveMutation.isPending,
    onSortingChange: setSorting,
    onPageChange: setPage,
    onPageSizeChange: setPageSize,
    onRemoveMember: async (memberId: string) => {
      await withPendingId(setRemovingMemberId, memberId, async () => {
        await removeMemberMutation.mutateAsync(memberId);
      });
    },
    onLeave: async () => {
      await leaveMutation.mutateAsync();
    },
  };
}
