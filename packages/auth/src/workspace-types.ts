const PERSONAL_WORKSPACE_SLUG_PREFIX = "personal"

export const PERSONAL_WORKSPACE_TYPE = "personal"
export const STANDARD_WORKSPACE_TYPE = "workspace"
export const PERSONAL_WORKSPACE_NAME = "Personal"
export const WORKSPACE_TYPES = [
  PERSONAL_WORKSPACE_TYPE,
  STANDARD_WORKSPACE_TYPE,
] as const

export type WorkspaceType = (typeof WORKSPACE_TYPES)[number]

export type PersonalWorkspaceFields = {
  workspaceType: typeof PERSONAL_WORKSPACE_TYPE
  personalOwnerUserId: string
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null

export function isPersonalWorkspace(workspace: unknown): boolean {
  return (
    isRecord(workspace) && workspace.workspaceType === PERSONAL_WORKSPACE_TYPE
  )
}

export function isPersonalWorkspaceOwnedByUser(
  workspace: unknown,
  userId: string
): boolean {
  if (!isRecord(workspace)) return false
  return (
    workspace.workspaceType === PERSONAL_WORKSPACE_TYPE &&
    workspace.personalOwnerUserId === userId
  )
}

export function buildPersonalWorkspaceSlug(userId: string): string {
  return `${PERSONAL_WORKSPACE_SLUG_PREFIX}-${userId.toLowerCase()}`
}
