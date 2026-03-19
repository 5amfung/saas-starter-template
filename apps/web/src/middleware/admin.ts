import { createMiddleware } from "@tanstack/react-start"
import { getRequestHeaders } from "@tanstack/react-start/server"
import { validateAdminSession as validateAdmin } from "@workspace/auth/validators"
import { auth } from "@/init"

/** Validates that the request has an admin session with verified email. */
export async function validateAdminSession(headers: Headers) {
  return validateAdmin(headers, auth)
}

export const adminMiddleware = createMiddleware().server(async ({ next }) => {
  const headers = getRequestHeaders()
  await validateAdminSession(headers)
  return await next()
})
