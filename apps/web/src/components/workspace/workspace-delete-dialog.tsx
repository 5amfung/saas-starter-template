import * as React from 'react';
import { IconAlertTriangle } from '@tabler/icons-react';
import { useMutation } from '@tanstack/react-query';
import { authClient } from '@workspace/auth/client';
import { toast } from 'sonner';
import {
  OPERATIONS,
  buildWorkflowAttributes,
  startWorkflowSpan,
  workflowLogger,
} from '@workspace/logging/client';
import { Button } from '@workspace/ui/components/button';
import { TypedConfirmDialog } from '@/components/shared/typed-confirm-dialog';

const CONFIRMATION_TEXT = 'DELETE';
const WORKFLOW_ROUTE = 'workspace-delete-dialog';

function buildWorkspaceDeleteAttributes(
  result: 'attempt' | 'success' | 'failure',
  workspaceId: string,
  failureCategory?: string
) {
  return buildWorkflowAttributes(OPERATIONS.WORKSPACE_DELETE, {
    route: WORKFLOW_ROUTE,
    workspaceId,
    result,
    ...(failureCategory ? { failureCategory } : {}),
  });
}

type WorkspaceDeleteDialogProps = {
  workspaceId: string;
  workspaceName: string;
  isDisabled: boolean;
  onDelete: () => Promise<string>;
};

export function WorkspaceDeleteDialog({
  workspaceId,
  workspaceName,
  isDisabled,
  onDelete,
}: WorkspaceDeleteDialogProps) {
  const [open, setOpen] = React.useState(false);

  const deleteMutation = useMutation({
    mutationFn: onDelete,
    onSuccess: async (nextWorkspaceId) => {
      const { error } = await authClient.organization.setActive({
        organizationId: nextWorkspaceId,
      });
      if (error) {
        workflowLogger.error(
          'Workspace deletion failed',
          buildWorkspaceDeleteAttributes(
            'failure',
            workspaceId,
            'activation_failed'
          )
        );
        toast.error(error.message || 'Failed to activate new workspace.');
        return;
      }

      workflowLogger.info(
        'Workspace deleted',
        buildWorkspaceDeleteAttributes('success', workspaceId)
      );
      toast.success('Workspace deleted successfully.');
      window.location.assign(`/ws/${nextWorkspaceId}/overview`);
    },
    onError: (error) => {
      workflowLogger.error(
        'Workspace deletion failed',
        buildWorkspaceDeleteAttributes('failure', workspaceId, 'delete_failed')
      );
      toast.error(error.message || 'Failed to delete workspace.');
    },
  });

  return (
    <div className="flex flex-col items-end gap-2">
      <Button
        variant="destructive"
        className="w-fit"
        disabled={isDisabled}
        onClick={() => setOpen(true)}
      >
        Delete Workspace
      </Button>
      <TypedConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title={
          <span className="inline-flex items-center gap-2">
            <span className="inline-flex size-8 items-center justify-center rounded-full bg-destructive/10">
              <IconAlertTriangle className="text-destructive" />
            </span>
            Delete Workspace
          </span>
        }
        description={
          <>
            This will permanently delete <strong>{workspaceName}</strong> and
            all associated workspace data. This action cannot be undone.
          </>
        }
        confirmLabel="Confirm delete"
        confirmationText={CONFIRMATION_TEXT}
        isPending={deleteMutation.isPending}
        confirmVariant="destructive"
        onConfirm={async () => {
          await startWorkflowSpan(
            {
              op: OPERATIONS.WORKSPACE_DELETE,
              name: 'Delete workspace',
              attributes: buildWorkspaceDeleteAttributes(
                'attempt',
                workspaceId
              ),
            },
            () => deleteMutation.mutateAsync()
          );
        }}
      />
    </div>
  );
}
