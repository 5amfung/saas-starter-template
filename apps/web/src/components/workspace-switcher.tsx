import * as React from 'react';
import { IconLoader2, IconPlus, IconSelector } from '@tabler/icons-react';
import { useMutation } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { toast } from 'sonner';
import { z } from 'zod';
import { authClient } from '@workspace/auth/client';
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
import { buildWorkspaceSlug } from '@/workspace/workspace';

const workspaceNameSchema = z
  .string()
  .trim()
  .min(1, { error: 'Workspace name is required.' })
  .regex(/^[a-zA-Z0-9_\- ]+$/, {
    error: 'Only letters, numbers, spaces, -, and _ are allowed.',
  });

export function WorkspaceSwitcher({
  workspaces,
  activeWorkspaceId,
}: {
  workspaces: Array<{
    id: string;
    name: string;
    logo: React.ReactNode;
  }>;
  activeWorkspaceId: string | null;
}) {
  const { isMobile } = useSidebar();
  const navigate = useNavigate();
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

  const matchedWorkspace = workspaces.find(
    (workspace) => workspace.id === activeWorkspaceId
  );
  const fallbackWorkspace = activeWorkspaceId ? null : workspaces[0];
  const activeWorkspace = matchedWorkspace ??
    fallbackWorkspace ?? {
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
      const { data, error } = await authClient.organization.create({
        name,
        slug: buildWorkspaceSlug(name),
      });
      if (error) throw new Error(error.message);
      if (!data.id) throw new Error('Failed to create workspace.');
      return data.id;
    },
    onSuccess: async (workspaceId) => {
      const { error } = await authClient.organization.setActive({
        organizationId: workspaceId,
      });
      if (error) {
        toast.error(
          error.message || 'Workspace was created but could not be activated.'
        );
        return;
      }
      setWorkspaceName('');
      setValidationError(null);
      setIsCreateDialogOpen(false);
      toast.success('Workspace created.');
      navigate({
        to: '/ws/$workspaceId/overview',
        params: { workspaceId },
      });
    },
    onError: (error) => {
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
            </div>
            <IconSelector className="ml-auto" />
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
                createWorkspaceMutation.mutate(result.data);
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
