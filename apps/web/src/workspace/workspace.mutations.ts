type WorkspaceSummary = {
  id: string;
  name: string;
  slug: string;
  createdAt: Date;
  logo?: string | null;
  metadata?: unknown;
};

export function renameWorkspaceInList(
  workspaces: Array<WorkspaceSummary> | undefined,
  workspaceId: string,
  nextName: string
) {
  if (!workspaces) return workspaces;

  return workspaces.map((workspace) =>
    workspace.id === workspaceId
      ? {
          ...workspace,
          name: nextName,
        }
      : workspace
  );
}

export function addWorkspaceToList(
  workspaces: Array<WorkspaceSummary> | undefined,
  workspace: WorkspaceSummary
) {
  if (!workspaces) {
    return [workspace];
  }

  if (workspaces.some((candidate) => candidate.id === workspace.id)) {
    return workspaces;
  }

  return [workspace, ...workspaces];
}
