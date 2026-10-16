import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/admin/advertisements")({
  head: () => ({
    meta: [
      { title: "Advertisements — CobraLearn Innotechcore Admin" },
      { name: "description", content: "Manage and showcase advertisement campaigns on your platform." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdvertisementsLayout,
});

function AdvertisementsLayout() {
  return <Outlet />;
}
