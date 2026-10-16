import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/admin/projects")({
  head: () => ({
    meta: [
      { title: "Projects — CobraLearn Innotechcore Admin" },
      { name: "description", content: "Manage and showcase CobraLearn innovative projects." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ProjectsLayout,
});

function ProjectsLayout() {
  return <Outlet />;
}
