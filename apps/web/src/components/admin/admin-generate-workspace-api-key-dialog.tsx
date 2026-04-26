import * as React from 'react';
import { IconKey, IconLoader2 } from '@tabler/icons-react';
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
import { Input } from '@workspace/ui/components/input';
import { Label } from '@workspace/ui/components/label';
import { createAdminWorkspaceApiKey } from '@/admin/workspaces.functions';
import { ADMIN_WORKSPACE_DETAIL_QUERY_KEY } from '@/admin/workspaces.queries';

export interface GeneratedWorkspaceApiKey {
  id: string;
  key: string;
  start: string | null;
  prefix: string | null;
}

interface AdminGenerateWorkspaceApiKeyDialogProps {
  workspaceId: string;
  onKeyCreated?: (apiKey: GeneratedWorkspaceApiKey) => void;
}

const WORKSPACE_API_KEY_NAME_MAX_LENGTH = 80;

export function AdminGenerateWorkspaceApiKeyDialog({
  workspaceId,
  onKeyCreated,
}: AdminGenerateWorkspaceApiKeyDialogProps) {
  const queryClient = useQueryClient();
  const [open, setOpen] = React.useState(false);
  const [name, setName] = React.useState('');
  const [nameError, setNameError] = React.useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: async (trimmedName: string) =>
      createAdminWorkspaceApiKey({
        data: {
          workspaceId,
          name: trimmedName,
        },
      }),
    onSuccess: (result) => {
      toast.success('Workspace API key created.');
      onKeyCreated?.({
        id: result.apiKeyId,
        key: result.generatedKey,
        start: result.keyStart ?? null,
        prefix: result.keyPrefix ?? null,
      });
      queryClient.invalidateQueries({
        queryKey: ADMIN_WORKSPACE_DETAIL_QUERY_KEY(workspaceId),
      });
      setOpen(false);
      setName('');
      setNameError(null);
    },
    onError: (error) => {
      toast.error(
        error instanceof Error ? error.message : 'Failed to create API key.'
      );
    },
  });

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    if (!nextOpen) {
      setName('');
      setNameError(null);
    }
  }

  function handleSubmit() {
    const trimmedName = name.trim();

    if (!trimmedName) {
      setNameError('Key name is required.');
      return;
    }

    setNameError(null);
    mutation.mutate(trimmedName);
  }

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogTrigger
        render={<Button size="sm">Generate new key</Button>}
      />
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogMedia className="bg-primary/10">
            <IconKey className="text-primary" />
          </AlertDialogMedia>
          <AlertDialogTitle>Generate new key</AlertDialogTitle>
          <AlertDialogDescription>
            Create a workspace-owned key for this customer workspace. Platform
            admins are acting on behalf of the workspace during Enterprise
            onboarding.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="grid gap-2">
          <Label htmlFor="workspace-api-key-name">Key name</Label>
          <Input
            id="workspace-api-key-name"
            value={name}
            maxLength={WORKSPACE_API_KEY_NAME_MAX_LENGTH}
            required
            placeholder="Production support key"
            aria-invalid={nameError ? true : undefined}
            aria-describedby={
              nameError ? 'workspace-api-key-name-error' : undefined
            }
            onChange={(event) => {
              setName(event.target.value);
              if (nameError && event.target.value.trim()) {
                setNameError(null);
              }
            }}
          />
          {nameError ? (
            <p
              id="workspace-api-key-name-error"
              className="text-sm text-destructive"
            >
              {nameError}
            </p>
          ) : null}
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={mutation.isPending}>
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            disabled={mutation.isPending}
            onClick={(event) => {
              event.preventDefault();
              handleSubmit();
            }}
          >
            {mutation.isPending ? (
              <IconLoader2 className="size-4 animate-spin" />
            ) : null}
            Save
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
