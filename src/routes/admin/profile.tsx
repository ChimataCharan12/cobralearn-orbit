import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/admin/profile")({
  head: () => ({
    meta: [
      { title: "Admin Profile — CobraLearn Innotechcore Admin" },
      {
        name: "description",
        content: "View and manage your admin account details, preferences and security settings.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ProfileLayout,
});

function ProfileLayout() {
  return <Outlet />;
}
