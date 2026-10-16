import { createFileRoute, notFound } from "@tanstack/react-router";
import { DetailPage } from "@/components/public/DetailPage";
import { adminClient } from "@/lib/api/admin-client";
import { projectToPublicDetailItem } from "@/lib/projects-data";

export const Route = createFileRoute("/projects/$slug")({
  loader: async ({ params }) => {
    const res = await adminClient.getPublicProjectBySlug(params.slug);
    if (!res.success || !res.data) {
      throw notFound();
    }
    return projectToPublicDetailItem(res.data);
  },
  head: ({ loaderData }) => {
    const title = loaderData?.title ?? "Project";
    return {
      meta: [
        { title: `${title} — CobraLearn` },
        { name: "description", content: loaderData?.description ?? "Explore a CobraLearn innovation project." },
        { property: "og:title", content: `${title} — CobraLearn` },
        { property: "og:description", content: loaderData?.description ?? "Explore a CobraLearn innovation project." },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary_large_image" },
      ],
    };
  },
  component: () => <DetailPage item={Route.useLoaderData()} type="projects" />,
});
