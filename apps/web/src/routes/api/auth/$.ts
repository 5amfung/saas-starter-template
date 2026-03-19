import { createFileRoute } from "@tanstack/react-router"
import { auth } from "@/auth/auth.server"
import { requestLogger } from "@/lib/logger"

export const Route = createFileRoute("/api/auth/$")({
  server: {
    middleware: [requestLogger],
    handlers: {
      GET: async ({ request }: { request: Request }) => {
        return await auth.handler(request)
      },
      POST: async ({ request }: { request: Request }) => {
        return await auth.handler(request)
      },
    },
  },
})
