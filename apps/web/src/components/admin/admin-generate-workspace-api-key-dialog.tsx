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
import { Label } from '@workspace/ui/components/label';
import { createAdminWorkspaceApiKey } from '@/admin/workspaces.functions';
import { ADMIN_WORKSPACE_DETAIL_QUERY_KEY } from '@/admin/workspaces.queries';

type AccessMode = 'read_only' | 'read_write';

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

const ACCESS_MODE_OPTIONS: Array<{
  value: AccessMode;
  label: string;
  description: string;
}> = [
  {
    value: 'read_only',
    label: 'Read only',
    description: 'Creates the workspace-owned Read API Key.',
  },
  {
    value: 'read_write',
    label: 'Read and Write',
    description: 'Creates the workspace-owned Read & Write API Key.',
  },
];

export function AdminGenerateWorkspaceApiKeyDialog({
  workspaceId,
  onKeyCreated,
}: AdminGenerateWorkspaceApiKeyDialogProps) {
  const queryClient = useQueryClient();
  const [open, setOpen] = React.useState(false);
  const [accessMode, setAccessMode] = React.useState<AccessMode>('read_only');

  const mutation = useMutation({
    mutationFn: async () =>
      createAdminWorkspaceApiKey({
        data: {
          workspaceId,
          accessMode,
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
      setAccessMode('read_only');
    },
    onError: (error) => {
      toast.error(
        error instanceof Error ? error.message : 'Failed to create API key.'
      );
    },
  });

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
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

        <fieldset className="grid gap-3">
          <legend className="text-sm font-medium">Access</legend>
          {ACCESS_MODE_OPTIONS.map((option) => {
            const checked = accessMode === option.value;

            return (
              <label
                key={option.value}
                className="flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors hover:bg-muted/40"
              >
                <input
                  type="radio"
                  name="workspace-api-key-access-mode"
                  value={option.value}
                  checked={checked}
                  onChange={() => setAccessMode(option.value)}
                  className="mt-1"
                />
                <span className="grid gap-1">
                  <Label className="cursor-pointer">{option.label}</Label>
                  <span className="text-sm text-muted-foreground">
                    {option.description}
                  </span>
                </span>
              </label>
            );
          })}
        </fieldset>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={mutation.isPending}>
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            disabled={mutation.isPending}
            onClick={(event) => {
              event.preventDefault();
              mutation.mutate();
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
