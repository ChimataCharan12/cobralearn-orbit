import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/admin/awards")({
  head: () => ({
    meta: [
      { title: "Awards & Achievements — CobraLearn Admin" },
      {
        name: "description",
        content: "Manage and showcase awards, recognitions and achievements on your platform.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AwardsLayout,
});

function AwardsLayout() {
  return <Outlet />;
}
