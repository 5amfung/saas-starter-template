// Import workspace helpers for local use.
import { isPersonalWorkspaceOwnedByUser as _isPersonalWorkspaceOwnedByUser } from "@workspace/auth"

// Re-export workspace type constants from @workspace/auth.
export {
  PERSONAL_WORKSPACE_TYPE,
  STANDARD_WORKSPACE_TYPE,
  PERSONAL_WORKSPACE_NAME,
  WORKSPACE_TYPES,
  type WorkspaceType,
  type PersonalWorkspaceFields,
  isPersonalWorkspace,
  isPersonalWorkspaceOwnedByUser,
  buildPersonalWorkspaceSlug,
} from "@workspace/auth"

const WORKSPACE_NAME_FALLBACK = "workspace"
const MAX_SLUG_BASE_LENGTH = 40
const RANDOM_SUFFIX_LENGTH = 6

// Pick personal workspace first then any one of the other workspaces.
export function pickDefaultWorkspace<T extends { id: string }>(
  workspaces: Array<T>,
  userId: string
): T | null {
  if (workspaces.length === 0) return null

  const ownedPersonalWorkspace =
    workspaces.find((workspace) =>
      _isPersonalWorkspaceOwnedByUser(workspace, userId)
    ) ?? null
  if (ownedPersonalWorkspace) return ownedPersonalWorkspace

  return workspaces[0] ?? null
}

export function buildWorkspaceSlugBase(name: string): string {
  const cleaned = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")

  if (!cleaned) return WORKSPACE_NAME_FALLBACK
  return cleaned.slice(0, MAX_SLUG_BASE_LENGTH)
}

export function buildWorkspaceSlug(name: string): string {
  const randomSuffix = Math.random()
    .toString(36)
    .slice(2, 2 + RANDOM_SUFFIX_LENGTH)
  return `${buildWorkspaceSlugBase(name)}-${randomSuffix}`
}
