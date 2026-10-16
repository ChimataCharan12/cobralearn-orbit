import { createFileRoute } from "@tanstack/react-router";
import { MediaLibraryPage } from "@/components/media/MediaLibraryPage";

export const Route = createFileRoute("/admin/media")({
  head: () => ({
    meta: [
      { title: "Media Library — CobraLearn Innotechcore Admin" },
      {
        name: "description",
        content: "Manage all your images, videos, documents and media files across projects, websites and campaigns.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: MediaLibraryPage,
});
