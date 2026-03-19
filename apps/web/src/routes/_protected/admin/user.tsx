import { Outlet, createFileRoute } from "@tanstack/react-router"

export const Route = createFileRoute("/_protected/admin/user")({
  component: UserLayout,
  staticData: { title: "User", breadcrumbHref: "/admin/user" },
})

function UserLayout() {
  return <Outlet />
}
