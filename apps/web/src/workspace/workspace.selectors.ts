type WorkspaceIdentity = {
  id: string;
  name: string;
};

export function mergeCurrentWorkspaceIntoList<T extends WorkspaceIdentity>(
  workspaces: Array<T> | undefined,
  currentWorkspace: WorkspaceIdentity | null | undefined
) {
  if (!workspaces) return workspaces;
  if (!currentWorkspace) return workspaces;

  return workspaces.map((workspace) =>
    workspace.id === currentWorkspace.id
      ? {
          ...workspace,
          name: currentWorkspace.name,
        }
      : workspace
  );
}
