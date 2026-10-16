import { createFileRoute, notFound } from "@tanstack/react-router";
import { DetailPage } from "@/components/public/DetailPage";
import { adminClient } from "@/lib/api/admin-client";
import { awardToPublicDetailItem } from "@/lib/awards-data";

export const Route = createFileRoute("/awards/$slug")({
  loader: async ({ params }) => {
    const res = await adminClient.getPublicAwardBySlug(params.slug);
    if (!res.success || !res.data) {
      throw notFound();
    }
    return awardToPublicDetailItem(res.data);
  },
  head: ({ loaderData }) => {
    const title = loaderData?.title ?? "Award & Achievement";
    return {
      meta: [
        { title: `${title} — CobraLearn` },
        { name: "description", content: loaderData?.description ?? "Explore a CobraLearn achievement." },
        { property: "og:title", content: `${title} — CobraLearn` },
        { property: "og:description", content: loaderData?.description ?? "Explore a CobraLearn achievement." },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary_large_image" },
      ],
    };
  },
  component: () => <DetailPage item={Route.useLoaderData()} type="awards" />,
});
