import { redirect } from "@tanstack/react-router"
import type { Auth } from "./auth.server"

/** Gets a verified session or throws redirect to /signin. */
export async function getVerifiedSession(headers: Headers, auth: Auth) {
  const session = await auth.api.getSession({ headers })
  if (!session || !session.user.emailVerified) {
    throw redirect({ to: "/signin" })
  }
  return session
}

/** Checks if user is authenticated. If so, throws redirect to /ws. */
export async function validateGuestSession(headers: Headers, auth: Auth) {
  const session = await auth.api.getSession({ headers })
  if (session?.user.emailVerified) {
    throw redirect({ to: "/ws" })
  }
}

/** Gets an admin session or throws redirect to /signin. */
export async function validateAdminSession(headers: Headers, auth: Auth) {
  const session = await auth.api.getSession({ headers })
  if (!session || !session.user.emailVerified) {
    throw redirect({ to: "/signin" })
  }
  if (session.user.role !== "admin") {
    throw redirect({ to: "/signin" })
  }
  return session
}
