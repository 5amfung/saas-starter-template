const WORKSPACE_NAME_FALLBACK = 'workspace';
const MAX_SLUG_BASE_LENGTH = 40;
const RANDOM_SUFFIX_LENGTH = 6;
const PERSONAL_WORKSPACE_SLUG_PREFIX = 'personal';

export const PERSONAL_WORKSPACE_TYPE = 'personal';
export const STANDARD_WORKSPACE_TYPE = 'workspace';
export const PERSONAL_WORKSPACE_NAME = 'Personal';
export const WORKSPACE_TYPES = [
  PERSONAL_WORKSPACE_TYPE,
  STANDARD_WORKSPACE_TYPE,
] as const;

export type WorkspaceType = (typeof WORKSPACE_TYPES)[number];

export type PersonalWorkspaceFields = {
  workspaceType: typeof PERSONAL_WORKSPACE_TYPE;
  personalOwnerUserId: string;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

export function isPersonalWorkspace(workspace: unknown): boolean {
  return (
    isRecord(workspace) && workspace.workspaceType === PERSONAL_WORKSPACE_TYPE
  );
}

export function isPersonalWorkspaceOwnedByUser(
  workspace: unknown,
  userId: string,
): boolean {
  if (!isRecord(workspace)) return false;
  return (
    workspace.workspaceType === PERSONAL_WORKSPACE_TYPE &&
    workspace.personalOwnerUserId === userId
  );
}

// Pick personal workspace first then any one of the other workspaces.
export function pickDefaultWorkspace<T extends { id: string }>(
  workspaces: Array<T>,
  userId: string,
): T | null {
  if (workspaces.length === 0) return null;

  const ownedPersonalWorkspace =
    workspaces.find((workspace) =>
      isPersonalWorkspaceOwnedByUser(workspace, userId),
    ) ?? null;
  if (ownedPersonalWorkspace) return ownedPersonalWorkspace;

  return workspaces[0] ?? null;
}

export function buildPersonalWorkspaceSlug(userId: string): string {
  return `${PERSONAL_WORKSPACE_SLUG_PREFIX}-${userId.toLowerCase()}`;
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
