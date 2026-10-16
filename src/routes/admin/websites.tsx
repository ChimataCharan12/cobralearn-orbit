import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/admin/websites")({
  head: () => ({
    meta: [
      { title: "Websites — CobraLearn Innotechcore Admin" },
      { name: "description", content: "Manage and showcase CobraLearn websites." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: WebsitesLayout,
});

function WebsitesLayout() {
  return <Outlet />;
}
