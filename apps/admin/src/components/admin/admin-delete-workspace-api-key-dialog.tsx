import * as React from 'react';
import { IconAlertTriangle, IconLoader2 } from '@tabler/icons-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
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
import { deleteAdminWorkspaceApiKey } from '@/admin/workspaces.functions';
import { ADMIN_WORKSPACE_DETAIL_QUERY_KEY } from '@/admin/workspaces.queries';

interface AdminDeleteWorkspaceApiKeyDialogProps {
  workspaceId: string;
  apiKeyId: string;
  apiKeyName: string | null;
}

export function AdminDeleteWorkspaceApiKeyDialog({
  workspaceId,
  apiKeyId,
  apiKeyName,
}: AdminDeleteWorkspaceApiKeyDialogProps) {
  const queryClient = useQueryClient();
  const [open, setOpen] = React.useState(false);

  const mutation = useMutation({
    mutationFn: async () =>
      deleteAdminWorkspaceApiKey({
        data: {
          workspaceId,
          apiKeyId,
        },
      }),
    onSuccess: () => {
      toast.success('Workspace API key deleted.');
      queryClient.invalidateQueries({
        queryKey: ADMIN_WORKSPACE_DETAIL_QUERY_KEY(workspaceId),
      });
      setOpen(false);
    },
    onError: (error) => {
      toast.error(
        error instanceof Error ? error.message : 'Failed to delete API key.'
      );
    },
  });

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger
        render={
          <Button variant="destructive" size="sm">
            Delete
          </Button>
        }
      />
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogMedia className="bg-destructive/10">
            <IconAlertTriangle className="text-destructive" />
          </AlertDialogMedia>
          <AlertDialogTitle>Delete API key</AlertDialogTitle>
          <AlertDialogDescription>
            This will permanently delete{' '}
            <strong>{apiKeyName ?? 'this workspace API key'}</strong>. The key
            belongs to the workspace and this hard delete cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={mutation.isPending}>
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={mutation.isPending}
            onClick={(event) => {
              event.preventDefault();
              mutation.mutate();
            }}
          >
            {mutation.isPending ? (
              <IconLoader2 className="size-4 animate-spin" />
            ) : null}
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
