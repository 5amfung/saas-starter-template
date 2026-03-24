const WORKSPACE_NAME_FALLBACK = 'workspace';
const MAX_SLUG_BASE_LENGTH = 40;
const RANDOM_SUFFIX_LENGTH = 6;

// Pick the first workspace from the list.
export function pickDefaultWorkspace<T extends { id: string }>(
  workspaces: Array<T>
): T | null {
  return workspaces[0] ?? null;
}

export function buildWorkspaceSlugBase(name: string): string {
  const cleaned = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');

  if (!cleaned) return WORKSPACE_NAME_FALLBACK;
  return cleaned.slice(0, MAX_SLUG_BASE_LENGTH);
}

export function buildWorkspaceSlug(name: string): string {
  const randomSuffix = Math.random()
    .toString(36)
    .slice(2, 2 + RANDOM_SUFFIX_LENGTH);
  return `${buildWorkspaceSlugBase(name)}-${randomSuffix}`;
}
