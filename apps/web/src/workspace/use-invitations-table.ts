import * as React from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  DEFAULT_INVITE_ROLES,
  INVITATION_PAGE_SIZE_DEFAULT,
  VALID_ORG_ROLES,
  emailSchema,
  withPendingId,
} from './workspace-members.types';
import type { WorkspaceInvitationRow } from '@/components/workspace/workspace-invitations-table';
import type { SortingState } from '@tanstack/react-table';
import type { InviteDraft, InviteRole } from './workspace-members.types';
import {
  OPERATIONS,
  buildWorkflowAttributes,
  workflowLogger,
} from '@/observability/client';
import { authClient } from '@/auth/client/auth-client';
import {
  cancelWorkspaceInvitation,
  inviteWorkspaceMember,
} from '@/workspace/workspace-members.functions';

const WORKFLOW_ROUTE = 'workspace-invitations';

export function useInvitationsTable(workspaceId: string) {
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(INVITATION_PAGE_SIZE_DEFAULT);
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [removingInvitationId, setRemovingInvitationId] = React.useState<
    string | null
  >(null);
  const [resendingInvitationId, setResendingInvitationId] = React.useState<
    string | null
  >(null);

  const [inviteDialogOpen, setInviteDialogOpen] = React.useState(false);
  const [inviteDraft, setInviteDraft] = React.useState<InviteDraft>({
    email: '',
    role: DEFAULT_INVITE_ROLES[0],
  });

  React.useEffect(() => {
    setPage(1);
  }, [pageSize, sorting]);

  const invitationsQuery = useQuery({
    queryKey: ['workspace', 'invitations', workspaceId],
    queryFn: async () => {
      const { data, error } = await authClient.organization.listInvitations({
        query: { organizationId: workspaceId },
      });
      if (error) throw new Error(error.message);

      return data
        .filter((invitation) => invitation.status === 'pending')
        .map((invitation) => ({
          id: invitation.id,
          email: invitation.email,
          role: invitation.role,
          invitedAt: invitation.createdAt,
        })) satisfies Array<WorkspaceInvitationRow>;
    },
  });

  const inviteMutation = useMutation({
    mutationFn: async (payload: { email: string; role: InviteRole }) => {
      await inviteWorkspaceMember({
        data: {
          email: payload.email,
          role: payload.role,
          workspaceId,
        },
      });
    },
    onSuccess: (_data, variables) => {
      workflowLogger.info(
        'Workspace invitation sent',
        buildWorkflowAttributes(OPERATIONS.WORKSPACE_MEMBER_INVITE, {
          route: WORKFLOW_ROUTE,
          workspaceId,
          memberRole: variables.role,
          result: 'success',
        })
      );
    },
    onError: (_error, variables) => {
      workflowLogger.error(
        'Workspace invitation failed',
        buildWorkflowAttributes(OPERATIONS.WORKSPACE_MEMBER_INVITE, {
          route: WORKFLOW_ROUTE,
          workspaceId,
          memberRole: variables.role,
          result: 'failure',
          failureCategory: 'invite_failed',
        })
      );
    },
  });

  const removeInvitationMutation = useMutation({
    mutationFn: async (invitationId: string) => {
      await cancelWorkspaceInvitation({
        data: {
          workspaceId,
          invitationId,
        },
      });
    },
    onSuccess: async () => {
      toast.success('Invitation removed.');
      await invitationsQuery.refetch();
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to remove invitation.');
    },
  });

  const resendInvitationMutation = useMutation({
    mutationFn: async (payload: {
      invitationId: string;
      email: string;
      role: string;
    }) => {
      const role = VALID_ORG_ROLES.includes(
        payload.role as (typeof VALID_ORG_ROLES)[number]
      )
        ? (payload.role as (typeof VALID_ORG_ROLES)[number])
        : 'member';
      await inviteWorkspaceMember({
        data: {
          email: payload.email,
          role: role === 'owner' ? 'admin' : role,
          workspaceId,
          resend: true,
        },
      });
    },
    onSuccess: async () => {
      toast.success('Invitation resent.');
      await invitationsQuery.refetch();
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to resend invitation.');
    },
  });

  const invitationsSorted = React.useMemo(() => {
    const list = [...(invitationsQuery.data ?? [])];
    const sort = sorting.length > 0 ? sorting[0] : null;
    if (!sort) return list;
    const direction = sort.desc ? -1 : 1;
    return list.sort((left, right) => {
      if (sort.id === 'invitedAt') {
        const leftDate = new Date(left.invitedAt).getTime();
        const rightDate = new Date(right.invitedAt).getTime();
        return (leftDate - rightDate) * direction;
      }
      return left.email.localeCompare(right.email) * direction;
    });
  }, [sorting, invitationsQuery.data]);

  const total = invitationsSorted.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const pageStart = (page - 1) * pageSize;
  const pageData = invitationsSorted.slice(pageStart, pageStart + pageSize);

  const submitInvite = async () => {
    const email = inviteDraft.email.trim().toLowerCase();
    const role = inviteDraft.role;

    if (!email) {
      toast.error('Email address is required.');
      return;
    }

    const valid = emailSchema.safeParse(email);
    if (!valid.success) {
      toast.error('Please enter a valid email address.');
      return;
    }
    if (!DEFAULT_INVITE_ROLES.includes(role)) {
      toast.error('Invalid role selected.');
      return;
    }

    try {
      await inviteMutation.mutateAsync({ email, role });
      toast.success('Invitation sent.');
      setInviteDialogOpen(false);
      setInviteDraft({ email: '', role: DEFAULT_INVITE_ROLES[0] });
      await invitationsQuery.refetch();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to send invitation.';
      toast.error(message);
    }
  };

  return {
    inviteDialog: {
      open: inviteDialogOpen,
      onOpenChange: setInviteDialogOpen,
      draft: inviteDraft,
      setDraft: setInviteDraft,
      isPending: inviteMutation.isPending,
      onSubmit: submitInvite,
    },
    data: pageData,
    total,
    page,
    pageSize,
    totalPages,
    sorting,
    isLoading: invitationsQuery.isPending && !invitationsQuery.data,
    removingInvitationId,
    resendingInvitationId,
    onSortingChange: setSorting,
    onPageChange: setPage,
    onPageSizeChange: setPageSize,
    onRemoveInvitation: async (invitationId: string) => {
      await withPendingId(setRemovingInvitationId, invitationId, async () => {
        await removeInvitationMutation.mutateAsync(invitationId);
      });
    },
    onResendInvitation: async (invitation: {
      id: string;
      email: string;
      role: string;
    }) => {
      await withPendingId(setResendingInvitationId, invitation.id, async () => {
        await resendInvitationMutation.mutateAsync({
          invitationId: invitation.id,
          email: invitation.email,
          role: invitation.role,
        });
      });
    },
  };
}
