import type * as React from "react"
import { z } from "zod"

export const MEMBER_PAGE_SIZE_DEFAULT = 10
export const INVITATION_PAGE_SIZE_DEFAULT = 10
export const DEFAULT_INVITE_ROLES = ["member", "admin"] as const
export const VALID_ORG_ROLES = ["member", "admin", "owner"] as const

export const emailSchema = z.email({
  error: "Please enter a valid email address.",
})

export type InviteRole = (typeof DEFAULT_INVITE_ROLES)[number]

export type InviteDraft = {
  email: string
  role: InviteRole
}

export async function withPendingId(
  setPendingId: React.Dispatch<React.SetStateAction<string | null>>,
  pendingId: string,
  action: () => Promise<void>
): Promise<void> {
  setPendingId(pendingId)
  try {
    await action()
  } finally {
    setPendingId(null)
  }
}
