import * as React from 'react';
import { IconAlertTriangle, IconLoader2 } from '@tabler/icons-react';
import { useMutation } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@workspace/ui/components/alert-dialog';
import { Button } from '@workspace/ui/components/button';
import { Input } from '@workspace/ui/components/input';

const CONFIRMATION_TEXT = 'DELETE';

type WorkspaceDeleteDialogProps = {
  workspaceId: string;
  workspaceName: string;
  isDisabled: boolean;
  onDelete: () => Promise<string>;
};

export function WorkspaceDeleteDialog({
  workspaceName,
  isDisabled,
  onDelete,
}: WorkspaceDeleteDialogProps) {
  const navigate = useNavigate();
  const [open, setOpen] = React.useState(false);
  const [confirmation, setConfirmation] = React.useState('');
  const isConfirmed = confirmation === CONFIRMATION_TEXT;

  const deleteMutation = useMutation({
    mutationFn: onDelete,
    onSuccess: (nextWorkspaceId) => {
      toast.success('Workspace deleted successfully.');
      navigate({
        to: '/ws/$workspaceId/overview',
        params: { workspaceId: nextWorkspaceId },
      });
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to delete workspace.');
    },
  });

  React.useEffect(() => {
    if (!open) setConfirmation('');
  }, [open]);

  return (
    <div className="flex flex-col items-end gap-2">
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogTrigger
          render={
            <Button
              variant="destructive"
              className="w-fit"
              disabled={isDisabled}
            >
              Delete Workspace
            </Button>
          }
        />
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogMedia className="bg-destructive/10">
              <IconAlertTriangle className="text-destructive" />
            </AlertDialogMedia>
            <AlertDialogTitle>Delete Workspace</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete <strong>{workspaceName}</strong> and
              all associated workspace data. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="flex flex-col gap-2">
            <label
              htmlFor="workspace-delete-confirm"
              className="text-sm font-medium"
            >
              Type <strong>{CONFIRMATION_TEXT}</strong> to confirm
            </label>
            <Input
              id="workspace-delete-confirm"
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
              placeholder={CONFIRMATION_TEXT}
              autoComplete="off"
            />
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={!isConfirmed || deleteMutation.isPending}
              onClick={(event) => {
                event.preventDefault();
                deleteMutation.mutate();
              }}
            >
              {deleteMutation.isPending && (
                <IconLoader2 className="size-4 animate-spin" />
              )}
              Confirm delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
