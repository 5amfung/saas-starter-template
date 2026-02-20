const WORKSPACE_NAME_FALLBACK = 'workspace';
const MAX_SLUG_BASE_LENGTH = 40;
const RANDOM_SUFFIX_LENGTH = 6;
const PERSONAL_WORKSPACE_SLUG_PREFIX = 'personal';

export const PERSONAL_WORKSPACE_TYPE = 'personal';
export const PERSONAL_WORKSPACE_NAME = 'Personal';
export const WORKSPACE_METADATA_KEYS = {
  workspaceType: 'workspaceType',
  personalOwnerUserId: 'personalOwnerUserId',
} as const;

export type WorkspaceMetadata = {
  workspaceType?: string;
  personalOwnerUserId?: string;
};

export type WorkspaceLike = {
  id: string;
  name: string;
  metadata?: unknown;
};

export function normalizeWorkspaceMetadata(metadata: unknown): WorkspaceMetadata {
  if (!metadata || typeof metadata !== 'object') return {};
  const value = metadata as Record<string, unknown>;
  const workspaceType = value[WORKSPACE_METADATA_KEYS.workspaceType];
  const personalOwnerUserId =
    value[WORKSPACE_METADATA_KEYS.personalOwnerUserId];
  return {
    workspaceType:
      typeof workspaceType === 'string' ? workspaceType : undefined,
    personalOwnerUserId:
      typeof personalOwnerUserId === 'string' ? personalOwnerUserId : undefined,
  };
}

export function parseWorkspaceMetadata(metadata: unknown): WorkspaceMetadata {
  if (typeof metadata === 'string') {
    try {
      return normalizeWorkspaceMetadata(JSON.parse(metadata));
    } catch {
      return {};
    }
  }
  return normalizeWorkspaceMetadata(metadata);
}

export function isPersonalWorkspace(metadata: unknown): boolean {
  return (
    normalizeWorkspaceMetadata(metadata).workspaceType === PERSONAL_WORKSPACE_TYPE
  );
}

export function isPersonalWorkspaceOwnedByUser(
  metadata: unknown,
  userId: string,
): boolean {
  const normalized = normalizeWorkspaceMetadata(metadata);
  return (
    normalized.workspaceType === PERSONAL_WORKSPACE_TYPE &&
    normalized.personalOwnerUserId === userId
  );
}

export function pickDefaultWorkspace<T extends WorkspaceLike>(
  workspaces: Array<T>,
  userId: string,
): T | null {
  if (workspaces.length === 0) return null;

  const ownedPersonalWorkspace =
    workspaces.find((workspace) =>
      isPersonalWorkspaceOwnedByUser(workspace.metadata, userId),
    ) ?? null;
  if (ownedPersonalWorkspace) return ownedPersonalWorkspace;

  return workspaces[0] ?? null;
}

export function buildPersonalWorkspaceSlug(userId: string): string {
  return `${PERSONAL_WORKSPACE_SLUG_PREFIX}-${userId.toLowerCase()}`;
}

export function createPersonalWorkspaceMetadata(
  userId: string,
): WorkspaceMetadata {
  return {
    workspaceType: PERSONAL_WORKSPACE_TYPE,
    personalOwnerUserId: userId,
  };
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
  const randomSuffix = Math.random().toString(36).slice(2, 2 + RANDOM_SUFFIX_LENGTH);
  return `${buildWorkspaceSlugBase(name)}-${randomSuffix}`;
}
