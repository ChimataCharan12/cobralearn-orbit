import { createFileRoute, notFound } from "@tanstack/react-router";
import { DetailPage } from "@/components/public/DetailPage";
import { adminClient } from "@/lib/api/admin-client";
import { websiteToPublicDetailItem } from "@/lib/websites-data";

export const Route = createFileRoute("/websites/$slug")({
  loader: async ({ params }) => {
    const res = await adminClient.getPublicWebsiteBySlug(params.slug);
    if (!res.success || !res.data) {
      throw notFound();
    }
    return websiteToPublicDetailItem(res.data);
  },
  head: ({ loaderData }) => {
    const title = loaderData?.title ?? "Website";
    return {
      meta: [
        { title: `${title} — CobraLearn` },
        { name: "description", content: loaderData?.description ?? "Explore a CobraLearn website." },
        { property: "og:title", content: `${title} — CobraLearn` },
        { property: "og:description", content: loaderData?.description ?? "Explore a CobraLearn website." },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary_large_image" },
      ],
    };
  },
  component: () => <DetailPage item={Route.useLoaderData()} type="websites" />,
});
