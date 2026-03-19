import { APIError } from "better-auth/api"
import {
  PERSONAL_WORKSPACE_TYPE,
  STANDARD_WORKSPACE_TYPE,
  WORKSPACE_TYPES,
} from "./workspace-types"

type WorkspaceType = (typeof WORKSPACE_TYPES)[number]

export const isWorkspaceType = (value: unknown): value is WorkspaceType =>
  typeof value === "string" &&
  (WORKSPACE_TYPES as ReadonlyArray<string>).includes(value)

export const asOptionalString = (value: unknown): string | undefined =>
  typeof value === "string" && value.length > 0 ? value : undefined

export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null

export const validateWorkspaceFields = (
  organization: Record<string, unknown>,
  context: "create" | "update"
) => {
  const workspaceType = organization.workspaceType
  const personalOwnerUserId = asOptionalString(organization.personalOwnerUserId)

  if (workspaceType !== undefined && !isWorkspaceType(workspaceType)) {
    throw new APIError("BAD_REQUEST", {
      message: "workspaceType must be personal or workspace",
    })
  }

  if (workspaceType === PERSONAL_WORKSPACE_TYPE && !personalOwnerUserId) {
    throw new APIError("BAD_REQUEST", {
      message: "personalOwnerUserId is required for personal workspaces",
    })
  }

  if (context === "create" && workspaceType === undefined) {
    throw new APIError("BAD_REQUEST", {
      message: "workspaceType is required",
    })
  }

  if (
    context === "update" &&
    personalOwnerUserId &&
    workspaceType === STANDARD_WORKSPACE_TYPE
  ) {
    throw new APIError("BAD_REQUEST", {
      message: "personalOwnerUserId is not allowed for workspace type",
    })
  }
}

const ensureTrailingSlashRemoved = (value: string): string =>
  value.endsWith("/") ? value.slice(0, -1) : value

/** Builds the accept-invite URL using the provided base URL. */
export const buildAcceptInviteUrl = (
  baseUrl: string,
  invitationId: string
): string => {
  const origin = ensureTrailingSlashRemoved(
    baseUrl && baseUrl.trim() !== "" ? baseUrl.trim() : "http://localhost:3000"
  )
  return `${origin}/accept-invite?id=${encodeURIComponent(invitationId)}`
}
