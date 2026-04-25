import * as React from 'react';
import {
  IconLoader2,
  IconLock,
  IconPlus,
  IconSelector,
  IconUsers,
} from '@tabler/icons-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { toast } from 'sonner';
import { z } from 'zod';
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@workspace/ui/components/dropdown-menu';
import { Input } from '@workspace/ui/components/input';
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@workspace/ui/components/sidebar';
import {
  OPERATIONS,
  buildWorkflowAttributes,
  startWorkflowSpan,
  workflowLogger,
} from '@/observability/client';
import { authClient } from '@/auth/client/auth-client';
import { generateSlug } from '@/auth';
import { addWorkspaceToList } from '@/workspace/workspace.mutations';
import { pickWorkspaceForSwitcher } from '@/workspace/workspace';
import { WORKSPACE_LIST_QUERY_KEY } from '@/workspace/workspace.queries';

const workspaceNameSchema = z
  .string()
  .trim()
  .min(1, { error: 'Workspace name is required.' })
  .regex(/^[a-zA-Z0-9_\- ]+$/, {
    error: 'Only letters, numbers, spaces, -, and _ are allowed.',
  });

const WORKFLOW_ROUTE = 'workspace-switcher';

function buildWorkspaceCreateAttributes(
  result: 'attempt' | 'success' | 'failure',
  workspaceId?: string,
  failureCategory?: string
) {
  return buildWorkflowAttributes(OPERATIONS.WORKSPACE_CREATE, {
    route: WORKFLOW_ROUTE,
    workspaceId,
    result,
    ...(failureCategory ? { failureCategory } : {}),
  });
}

export function WorkspaceSwitcher({
  workspaces,
  activeWorkspaceId,
  triggerDetail,
}: {
  workspaces: Array<{
    id: string;
    name: string;
    logo: React.ReactNode;
  }>;
  activeWorkspaceId: string | null;
  triggerDetail?: { planName: string; memberCount: number } | null;
}) {
  const { isMobile } = useSidebar();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = React.useState(false);
  const [workspaceName, setWorkspaceName] = React.useState('');
  const [validationError, setValidationError] = React.useState<string | null>(
    null
  );
  const handleCreateDialogOpenChange = (isOpen: boolean) => {
    setIsCreateDialogOpen(isOpen);
    if (!isOpen) {
      setWorkspaceName('');
      setValidationError(null);
    }
  };

  const activeWorkspace = pickWorkspaceForSwitcher(
    workspaces,
    activeWorkspaceId
  ) ?? {
    id: 'placeholder-workspace',
    name: '',
    logo: <IconPlus className="size-4" />,
  };

  const setActiveMutation = useMutation({
    mutationFn: async (organizationId: string) => {
      const { error } = await authClient.organization.setActive({
        organizationId,
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: (_value, organizationId) => {
      void queryClient.invalidateQueries({
        queryKey: WORKSPACE_LIST_QUERY_KEY,
      });
      navigate({
        to: '/ws/$workspaceId/overview',
        params: { workspaceId: organizationId },
      });
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to switch workspace.');
    },
  });

  const createWorkspaceMutation = useMutation({
    mutationFn: async (name: string) => {
      const slug = generateSlug();
      const { data, error } = await authClient.organization.create({
        name,
        slug,
      });
      if (error) throw new Error(error.message);
      if (!data.id) throw new Error('Failed to create workspace.');
      return {
        ...data,
        name,
        slug: data.slug,
      };
    },
    onSuccess: async (workspace) => {
      const { error } = await authClient.organization.setActive({
        organizationId: workspace.id,
      });
      if (error) {
        workflowLogger.error(
          'Workspace creation failed',
          buildWorkspaceCreateAttributes(
            'failure',
            workspace.id,
            'activation_failed'
          )
        );
        toast.error(
          error.message || 'Workspace was created but could not be activated.'
        );
        return;
      }
      queryClient.setQueryData(
        WORKSPACE_LIST_QUERY_KEY,
        (
          current:
            | Array<{
                id: string;
                name: string;
                slug: string;
                createdAt: Date;
                logo?: string | null;
                metadata?: unknown;
              }>
            | undefined
        ) => addWorkspaceToList(current, workspace)
      );
      void queryClient.invalidateQueries({
        queryKey: WORKSPACE_LIST_QUERY_KEY,
      });
      setWorkspaceName('');
      setValidationError(null);
      setIsCreateDialogOpen(false);
      workflowLogger.info(
        'Workspace created',
        buildWorkspaceCreateAttributes('success', workspace.id)
      );
      toast.success('Workspace created.');
      navigate({
        to: '/ws/$workspaceId/overview',
        params: { workspaceId: workspace.id },
      });
    },
    onError: (error) => {
      workflowLogger.error(
        'Workspace creation failed',
        buildWorkspaceCreateAttributes('failure', undefined, 'create_failed')
      );
      toast.error(error.message || 'Failed to create workspace.');
    },
  });

  const canCreateWorkspace = workspaceName.trim().length > 0;

  const handleAddWorkspace = () => {
    setIsCreateDialogOpen(true);
  };

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <SidebarMenuButton
                size="lg"
                className="data-open:bg-sidebar-accent data-open:text-sidebar-accent-foreground"
              />
            }
          >
            <div className="flex aspect-square size-8 items-center justify-center rounded-lg border">
              {activeWorkspace.logo}
            </div>
            <div className="grid flex-1 text-left text-sm leading-tight">
              <span className="truncate font-medium">
                {activeWorkspace.name}
              </span>
              {triggerDetail ? (
                <span className="flex min-w-0 items-center gap-1 text-xs text-muted-foreground">
                  <span
                    data-testid="workspace-switcher-trigger-plan-name"
                    className="min-w-0 truncate"
                  >
                    {triggerDetail.planName}
                  </span>
                  {triggerDetail.memberCount > 1 ? (
                    <IconUsers
                      data-testid="workspace-switcher-trigger-users-icon"
                      className="size-3.5 shrink-0"
                    />
                  ) : (
                    <IconLock
                      data-testid="workspace-switcher-trigger-lock-icon"
                      className="size-3.5 shrink-0"
                    />
                  )}
                </span>
              ) : null}
            </div>
            <IconSelector
              data-testid="workspace-switcher-selector-icon"
              className="ml-auto"
            />
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="min-w-56 rounded-lg"
            align="start"
            side={isMobile ? 'bottom' : 'right'}
            sideOffset={4}
          >
            <DropdownMenuGroup>
              <DropdownMenuLabel className="text-xs text-muted-foreground">
                Workspaces
              </DropdownMenuLabel>
              {workspaces.map((workspace) => (
                <DropdownMenuItem
                  key={workspace.id}
                  onClick={() => setActiveMutation.mutate(workspace.id)}
                  className="gap-2 p-2"
                >
                  <div className="flex size-6 items-center justify-center rounded-md border">
                    {workspace.logo}
                  </div>
                  {workspace.name}
                </DropdownMenuItem>
              ))}
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem
                className="gap-2 p-2"
                onClick={handleAddWorkspace}
              >
                <div className="flex size-6 items-center justify-center rounded-md border bg-transparent">
                  <IconPlus className="size-4" />
                </div>
                <div className="font-medium text-muted-foreground">
                  Add workspace
                </div>
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
      <AlertDialog
        open={isCreateDialogOpen}
        onOpenChange={handleCreateDialogOpenChange}
      >
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogTitle>Create Workspace</AlertDialogTitle>
            <AlertDialogDescription>
              Enter a workspace name to create and activate it.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="grid gap-2">
            <Input
              value={workspaceName}
              onChange={(event) => {
                setWorkspaceName(event.target.value);
                setValidationError(null);
              }}
              placeholder="Workspace name"
              autoFocus
              aria-invalid={!!validationError}
              aria-describedby={
                validationError ? 'workspace-name-error' : undefined
              }
            />
            {validationError ? (
              <p
                id="workspace-name-error"
                role="alert"
                className="text-sm text-destructive"
              >
                {validationError}
              </p>
            ) : null}
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={createWorkspaceMutation.isPending}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={
                !canCreateWorkspace || createWorkspaceMutation.isPending
              }
              onClick={(event) => {
                event.preventDefault();
                const result = workspaceNameSchema.safeParse(workspaceName);
                if (!result.success) {
                  setValidationError(result.error.issues[0].message);
                  return;
                }
                setValidationError(null);
                void startWorkflowSpan(
                  {
                    op: OPERATIONS.WORKSPACE_CREATE,
                    name: 'Create workspace',
                    attributes: buildWorkspaceCreateAttributes('attempt'),
                  },
                  () => createWorkspaceMutation.mutateAsync(result.data)
                );
              }}
            >
              {createWorkspaceMutation.isPending && (
                <IconLoader2 className="size-4 animate-spin" />
              )}
              Create
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </SidebarMenu>
  );
}
