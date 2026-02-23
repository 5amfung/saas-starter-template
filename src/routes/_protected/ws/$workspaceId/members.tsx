import * as React from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { WorkspaceInviteDialog } from '@/components/workspace/workspace-invite-dialog';
import { WorkspaceInvitationsTable } from '@/components/workspace/workspace-invitations-table';
import { WorkspaceMembersTable } from '@/components/workspace/workspace-members-table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DEFAULT_INVITE_ROLES } from '@/workspace/workspace-members.types';
import { useInvitationsTable } from '@/workspace/use-invitations-table';
import { useMembersTable } from '@/workspace/use-members-table';

export const Route = createFileRoute('/_protected/ws/$workspaceId/members')({
  component: WorkspaceMembersPage,
  staticData: { title: 'Members' },
});

function WorkspaceMembersPage() {
  const { workspaceId } = Route.useParams();
  const [activeTab, setActiveTab] = React.useState<'members' | 'invitations'>(
    'members',
  );

  const { currentUserRole, ...membersTableProps } =
    useMembersTable(workspaceId);

  const { inviteDialog, ...invitationsTableProps } =
    useInvitationsTable(workspaceId);

  const canInvite = currentUserRole === 'owner' || currentUserRole === 'admin';
  const membersTablePropsWithRole = { ...membersTableProps, currentUserRole };

  return (
    <div className="flex flex-col gap-4 py-4 md:py-6">
      <div className="px-4 lg:px-6">
        <Tabs
          value={activeTab}
          onValueChange={(value) =>
            setActiveTab(value as 'members' | 'invitations')
          }
          className="w-full"
        >
          <div className="flex items-center justify-between gap-3">
            <TabsList>
              <TabsTrigger value="members">Team Members</TabsTrigger>
              <TabsTrigger value="invitations">Pending Invitations</TabsTrigger>
            </TabsList>
            {canInvite ? (
              <WorkspaceInviteDialog
                open={inviteDialog.open}
                onOpenChange={inviteDialog.onOpenChange}
                email={inviteDialog.draft.email}
                role={inviteDialog.draft.role}
                roles={DEFAULT_INVITE_ROLES}
                isPending={inviteDialog.isPending}
                onEmailChange={(email) =>
                  inviteDialog.setDraft((current) => ({ ...current, email }))
                }
                onRoleChange={(role) =>
                  inviteDialog.setDraft((current) => ({ ...current, role }))
                }
                onSubmit={() => {
                  void inviteDialog.onSubmit();
                }}
              />
            ) : null}
          </div>

          <TabsContent value="members" className="mt-4">
            <WorkspaceMembersTable {...membersTablePropsWithRole} />
          </TabsContent>

          <TabsContent value="invitations" className="mt-4">
            <WorkspaceInvitationsTable {...invitationsTableProps} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
