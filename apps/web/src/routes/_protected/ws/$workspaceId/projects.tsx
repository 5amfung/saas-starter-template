import { createFileRoute } from "@tanstack/react-router"

export const Route = createFileRoute("/_protected/ws/$workspaceId/projects")({
  component: WorkspaceProjectsPage,
  staticData: { title: "Projects" },
})

function WorkspaceProjectsPage() {
  return (
    <div className="flex flex-1 items-center justify-center py-12">
      <div className="text-center">
        <h2 className="text-lg font-medium">Projects</h2>
        <p className="text-sm text-muted-foreground">Coming soon.</p>
      </div>
    </div>
  )
}
