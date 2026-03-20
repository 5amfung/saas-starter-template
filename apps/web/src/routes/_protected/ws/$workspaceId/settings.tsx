import * as React from 'react';
import { IconLoader2 } from '@tabler/icons-react';
import { useForm } from '@tanstack/react-form';
import { useMutation } from '@tanstack/react-query';
import { createFileRoute, getRouteApi } from '@tanstack/react-router';
import { toast } from 'sonner';
import { z } from 'zod';
import { authClient } from '@workspace/auth/client';
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
import { WorkspaceDeleteDialog } from '@/components/workspace/workspace-delete-dialog';
import { toFieldErrorItem } from '@/lib/form-utils';
import { isPersonalWorkspace } from '@/workspace/workspace';

const workspaceSettingsSchema = z.object({
  name: z.string().trim().min(1, 'Workspace name is required.'),
});

const PAGE_LAYOUT_CLASS =
  'mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-4 md:py-6 lg:px-6';

const hasOwnerRole = (role: string | null): boolean =>
  !!role &&
  role
    .split(',')
    .map((item) => item.trim())
    .includes('owner');

const sortByCreatedAtAscending = (
  left: { createdAt?: string | Date },
  right: { createdAt?: string | Date }
): number => {
  const leftDate = left.createdAt ? new Date(left.createdAt).getTime() : 0;
  const rightDate = right.createdAt ? new Date(right.createdAt).getTime() : 0;
  return leftDate - rightDate;
};

export const Route = createFileRoute('/_protected/ws/$workspaceId/settings')({
  component: WorkspaceSettingsPage,
  staticData: { title: 'Workspace Settings' },
});

const workspaceRouteApi = getRouteApi('/_protected/ws/$workspaceId');

function WorkspaceSettingsPage() {
  const { workspaceId } = Route.useParams();
  const workspace = workspaceRouteApi.useLoaderData();
  const { data: activeOrganization } = authClient.useActiveOrganization();

  const [activeRole, setActiveRole] = React.useState<string | null>(null);

  React.useEffect(() => {
    let isMounted = true;
    const loadActiveRole = async () => {
      const { data, error } =
        await authClient.organization.getActiveMemberRole();
      if (!isMounted) return;
      if (error) return;
      setActiveRole(typeof data.role === 'string' ? data.role : null);
    };
    void loadActiveRole();
    return () => {
      isMounted = false;
    };
  }, [workspaceId]);

  const isPersonal = isPersonalWorkspace(workspace);
  const isOwner = hasOwnerRole(activeRole);
  const canDelete = isOwner && !isPersonal;
  const deleteDisabledMessage = isPersonal
    ? 'Personal workspace can not be deleted'
    : isOwner
      ? null
      : 'Only owner can delete this workspace';

  // This keeps the input stable during save and avoids the brief revert.
  const [initialWorkspaceName, setInitialWorkspaceName] = React.useState(
    workspace.name
  );
  React.useEffect(() => {
    setInitialWorkspaceName(workspace.name);
  }, [workspaceId]);

  const updateMutation = useMutation({
    mutationFn: async (name: string) => {
      if (activeOrganization?.id !== workspaceId) {
        const { error: setActiveError } =
          await authClient.organization.setActive({
            organizationId: workspaceId,
          });
        if (setActiveError) throw new Error(setActiveError.message);
      }

      const { error } = await authClient.organization.update({
        data: {
          name,
        },
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
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

  const getNextWorkspaceIdAfterDelete = React.useCallback(async () => {
    const { data } = await authClient.organization.list();
    if (!data) return null;

    const remaining = data
      .filter((candidate) => candidate.id !== workspaceId)
      .sort(sortByCreatedAtAscending);
    const personal = remaining.find((candidate) =>
      isPersonalWorkspace(candidate)
    );
    // Switch to personal workspace after deleting current workspace.
    return personal?.id ?? remaining.at(0)?.id ?? null;
  }, [workspaceId]);

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
                      <FieldLabel htmlFor={field.name}>
                        Workspace Name
                      </FieldLabel>
                      <Input
                        id={field.name}
                        value={field.state.value}
                        onBlur={field.handleBlur}
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
                    disabled={!isDirty || isSubmitting}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={!isDirty || !canSubmit || isSubmitting}
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
            isDisabled={!canDelete}
            getNextWorkspaceIdAfterDelete={getNextWorkspaceIdAfterDelete}
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
