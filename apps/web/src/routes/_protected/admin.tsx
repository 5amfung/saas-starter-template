import { Outlet, createFileRoute } from "@tanstack/react-router"
import { adminMiddleware } from "@/middleware/admin"

export const Route = createFileRoute("/_protected/admin")({
  component: AdminLayout,
  staticData: { title: "Admin", breadcrumbHref: "/admin/dashboard" },
  server: {
    middleware: [adminMiddleware],
  },
})

function AdminLayout() {
  return <Outlet />
}
