import * as React from 'react';
import { IconLoader2 } from '@tabler/icons-react';
import { useForm } from '@tanstack/react-form';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createFileRoute, notFound } from '@tanstack/react-router';
import { toast } from 'sonner';
import { z } from 'zod';
import { Button } from '@workspace/ui/components/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@workspace/ui/components/card';
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from '@workspace/ui/components/field';
import { Input } from '@workspace/ui/components/input';
import { Separator } from '@workspace/ui/components/separator';
import { toFieldErrorItem } from '@workspace/components/lib';
import { WorkspaceDeleteDialog } from '@/components/workspace/workspace-delete-dialog';
import { getWorkspaceCapabilities } from '@/policy/workspace-capabilities.functions';
import { getWorkspaceLifecycleCapabilities } from '@/policy/workspace-lifecycle-capabilities.functions';
import { useWorkspacesQuery } from '@/hooks/use-workspaces-query';
import { renameWorkspaceInList } from '@/workspace/workspace.mutations';
import {
  WORKSPACE_DETAIL_QUERY_KEY,
  WORKSPACE_LIST_QUERY_KEY,
  useWorkspaceDetailQuery,
} from '@/workspace/workspace.queries';
import {
  deleteWorkspace,
  updateWorkspaceSettings,
} from '@/workspace/workspace-settings.functions';

const workspaceSettingsSchema = z.object({
  name: z.string().trim().min(1, 'Workspace name is required.'),
});

const PAGE_LAYOUT_CLASS =
  'mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-4 md:py-6 lg:px-6';

type WorkspaceDetail = {
  id: string;
  name: string;
  slug: string;
  createdAt: Date;
  logo?: string | null;
  metadata?: unknown;
};

function renameWorkspaceDetail(
  workspace: WorkspaceDetail | undefined,
  nextName: string
) {
  if (!workspace) return workspace;

  return {
    ...workspace,
    name: nextName,
  };
}

export const Route = createFileRoute('/_protected/ws/$workspaceId/settings')({
  loader: async ({ params }) => {
    const [capabilities, lifecycle] = await Promise.all([
      getWorkspaceCapabilities({
        data: { workspaceId: params.workspaceId },
      }),
      getWorkspaceLifecycleCapabilities({
        data: { workspaceId: params.workspaceId },
      }),
    ]);

    if (!capabilities.canViewSettings) {
      throw notFound({ routeId: '__root__' });
    }

    return {
      ...capabilities,
      canDeleteWorkspace: lifecycle.canDeleteWorkspace,
      deleteWorkspaceBlockedReason: lifecycle.deleteWorkspaceBlockedReason,
    };
  },
  component: WorkspaceSettingsPage,
  staticData: { title: 'Workspace Settings' },
});

function WorkspaceSettingsPage() {
  const { workspaceId } = Route.useParams();
  const capabilities = Route.useLoaderData();
  const queryClient = useQueryClient();
  const { data: workspace } = useWorkspaceDetailQuery(workspaceId);

  useWorkspacesQuery();

  if (!workspace) return null;

  const deleteDisabledMessage =
    capabilities.deleteWorkspaceBlockedReason === 'not-owner'
      ? 'Only the owner can delete this workspace.'
      : capabilities.deleteWorkspaceBlockedReason === 'active-subscription'
        ? 'This workspace can only be deleted after the subscription has ended.'
        : capabilities.deleteWorkspaceBlockedReason ===
            'last-personal-workspace'
          ? 'Cannot delete your last personal workspace.'
          : null;

  // This keeps the input stable during save and avoids the brief revert.
  const [initialWorkspaceName, setInitialWorkspaceName] = React.useState(
    workspace.name
  );
  React.useEffect(() => {
    setInitialWorkspaceName(workspace.name);
  }, [workspaceId, workspace.name]);

  const updateMutation = useMutation({
    mutationFn: async (name: string) => {
      await updateWorkspaceSettings({
        data: {
          workspaceId,
          name,
        },
      });
    },
    onSuccess: (_data, nextName) => {
      queryClient.setQueryData(
        WORKSPACE_LIST_QUERY_KEY,
        (
          previous:
            | Array<{
                id: string;
                name: string;
                slug: string;
                createdAt: Date;
                logo?: string | null;
                metadata?: unknown;
              }>
            | undefined
        ) => renameWorkspaceInList(previous, workspaceId, nextName)
      );
      queryClient.setQueryData<WorkspaceDetail | undefined>(
        WORKSPACE_DETAIL_QUERY_KEY(workspaceId),
        (previous) => renameWorkspaceDetail(previous, nextName)
      );
      toast.success('Workspace updated.');
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to update workspace.');
    },
  });

  const form = useForm({
    defaultValues: {
      name: initialWorkspaceName,
    },
    validators: {
      onBlur: workspaceSettingsSchema,
      onSubmit: workspaceSettingsSchema,
    },
    onSubmit: async ({ value }) => {
      const nextName = value.name.trim();
      await updateMutation.mutateAsync(nextName);
      setInitialWorkspaceName(nextName);
      form.reset({ name: nextName });
    },
  });

  return (
    <div className={PAGE_LAYOUT_CLASS}>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          form.handleSubmit();
        }}
      >
        <Card>
          <CardHeader>
            <CardTitle>Workspace</CardTitle>
            <CardDescription>
              Manage workspace settings and metadata.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <FieldGroup>
              <form.Field
                name="name"
                children={(field) => {
                  const isInvalid =
                    field.state.meta.isBlurred && !field.state.meta.isValid;
                  return (
                    <Field data-invalid={isInvalid || undefined}>
                      <FieldLabel htmlFor="workspace-name">
                        Workspace Name
                      </FieldLabel>
                      <Input
                        id="workspace-name"
                        autoComplete="off"
                        data-1p-ignore
                        value={field.state.value}
                        onBlur={field.handleBlur}
                        disabled={!capabilities.canManageSettings}
                        onChange={(event) =>
                          field.handleChange(event.target.value)
                        }
                        aria-invalid={isInvalid}
                      />
                      {isInvalid ? (
                        <FieldError
                          errors={field.state.meta.errors.map(toFieldErrorItem)}
                        />
                      ) : null}
                    </Field>
                  );
                }}
              />
            </FieldGroup>
          </CardContent>
          <CardFooter className="flex justify-end gap-2">
            <form.Subscribe
              selector={(state) => [
                state.isDirty,
                state.isSubmitting,
                state.canSubmit,
              ]}
              children={([isDirty, isSubmitting, canSubmit]) => (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => form.reset()}
                    disabled={
                      !capabilities.canManageSettings ||
                      !isDirty ||
                      isSubmitting
                    }
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={
                      !capabilities.canManageSettings ||
                      !isDirty ||
                      !canSubmit ||
                      isSubmitting
                    }
                  >
                    {isSubmitting && (
                      <IconLoader2 className="size-4 animate-spin" />
                    )}
                    Save
                  </Button>
                </>
              )}
            />
          </CardFooter>
        </Card>
      </form>
      <Separator />
      <div className="flex flex-col gap-4 rounded-lg border border-dashed border-destructive/30 p-4">
        <div>
          <h3 className="text-sm font-medium">Danger Zone</h3>
          <p className="text-sm text-muted-foreground">
            Permanently delete this workspace and all associated data.
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <WorkspaceDeleteDialog
            workspaceId={workspace.id}
            workspaceName={workspace.name}
            isDisabled={!capabilities.canDeleteWorkspace}
            onDelete={async () => {
              const result = await deleteWorkspace({
                data: { workspaceId: workspace.id },
              });

              return result.nextWorkspaceId;
            }}
          />
          {deleteDisabledMessage ? (
            <p className="text-xs text-muted-foreground">
              {deleteDisabledMessage}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
