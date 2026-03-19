// src/middleware/admin.ts
import { redirect } from "@tanstack/react-router"
import { createMiddleware } from "@tanstack/react-start"
import { getRequestHeaders } from "@tanstack/react-start/server"
import { auth } from "@/auth/auth.server"

/** Validates that the request has an admin session with verified email. */
export async function validateAdminSession(headers: Headers) {
  const session = await auth.api.getSession({ headers })
  if (!session || !session.user.emailVerified) {
    throw redirect({ to: "/signin" })
  }
  if (session.user.role !== "admin") {
    throw redirect({ to: "/signin" })
  }
  return session
}

export const adminMiddleware = createMiddleware().server(async ({ next }) => {
  const headers = getRequestHeaders()
  await validateAdminSession(headers)
  return await next()
})
