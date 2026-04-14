// Pick the first workspace from the list.
export function pickDefaultWorkspace<T extends { id: string }>(
  workspaces: Array<T>
): T | null {
  return workspaces[0] ?? null;
}

// Resolve the workspace that the switcher should display before it falls back
// to the placeholder state.
export function pickWorkspaceForSwitcher<T extends { id: string }>(
  workspaces: Array<T>,
  activeWorkspaceId: string | null
): T | null {
  const matchedWorkspace = workspaces.find(
    (workspace) => workspace.id === activeWorkspaceId
  );
  const fallbackWorkspace = activeWorkspaceId ? null : workspaces[0];
  return matchedWorkspace ?? fallbackWorkspace ?? null;
}
