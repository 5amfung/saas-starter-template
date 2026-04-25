import { IconLoader2, IconSend } from '@tabler/icons-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@workspace/ui/components/alert-dialog';
import { Input } from '@workspace/ui/components/input';
import { Label } from '@workspace/ui/components/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@workspace/ui/components/select';
import type { InviteRole } from '@/workspace/workspace-members.types';
import {
  OPERATIONS,
  buildWorkflowAttributes,
  startWorkflowSpan,
  workflowLogger,
} from '@/observability/client';

interface WorkspaceInviteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  email: string;
  role: InviteRole;
  roles: ReadonlyArray<InviteRole>;
  isPending: boolean;
  onEmailChange: (email: string) => void;
  onRoleChange: (role: InviteRole) => void;
  onSubmit: () => void;
}

const WORKFLOW_ROUTE = 'workspace-invite-dialog';

export function WorkspaceInviteDialog({
  open,
  onOpenChange,
  email,
  role,
  roles,
  isPending,
  onEmailChange,
  onRoleChange,
  onSubmit,
}: WorkspaceInviteDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Invite Member</AlertDialogTitle>
          <AlertDialogDescription>
            Send an invitation email to join this workspace.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="invite-member-email">Email</Label>
            <Input
              id="invite-member-email"
              placeholder="jane@example.com"
              autoComplete="off"
              data-1p-ignore
              data-lpignore="true"
              value={email}
              onChange={(event) => onEmailChange(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="invite-member-role">Role</Label>
            <Select
              value={role}
              onValueChange={(value) => {
                const nextRole = roles.find((r) => r === value);
                if (nextRole) {
                  onRoleChange(nextRole);
                }
              }}
            >
              <SelectTrigger id="invite-member-role">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {roles.map((option) => (
                  <SelectItem key={option} value={option}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            disabled={isPending}
            onClick={(event) => {
              event.preventDefault();
              void startWorkflowSpan(
                {
                  op: OPERATIONS.WORKSPACE_MEMBER_INVITE,
                  name: 'Invite workspace member',
                  attributes: buildWorkflowAttributes(
                    OPERATIONS.WORKSPACE_MEMBER_INVITE,
                    {
                      route: WORKFLOW_ROUTE,
                      memberRole: role,
                      result: 'attempt',
                    }
                  ),
                },
                async () => {
                  workflowLogger.info(
                    'Workspace invitation submitted',
                    buildWorkflowAttributes(
                      OPERATIONS.WORKSPACE_MEMBER_INVITE,
                      {
                        route: WORKFLOW_ROUTE,
                        memberRole: role,
                        result: 'attempt',
                      }
                    )
                  );

                  try {
                    await Promise.resolve(onSubmit());
                  } catch (error) {
                    workflowLogger.error(
                      'Workspace invitation failed',
                      buildWorkflowAttributes(
                        OPERATIONS.WORKSPACE_MEMBER_INVITE,
                        {
                          route: WORKFLOW_ROUTE,
                          memberRole: role,
                          result: 'failure',
                          failureCategory: 'submission_failed',
                        }
                      )
                    );
                    throw error;
                  }
                }
              );
            }}
          >
            {isPending ? (
              <IconLoader2 className="size-4 animate-spin" />
            ) : (
              <IconSend className="size-4" />
            )}
            Send Invitation
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
