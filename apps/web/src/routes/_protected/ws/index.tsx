import { createFileRoute, redirect } from "@tanstack/react-router"
import { getActiveWorkspaceId } from "@/workspace/workspace.functions"

export const Route = createFileRoute("/_protected/ws/")({
  component: WorkspaceIndexPage,
  loader: async () => {
    const workspaceId = await getActiveWorkspaceId()
    throw redirect({
      to: "/ws/$workspaceId/overview",
      params: { workspaceId },
      replace: true,
    })
  },
})

function WorkspaceIndexPage() {
  return null
}
