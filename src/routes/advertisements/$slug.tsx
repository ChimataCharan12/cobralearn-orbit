import { createFileRoute, notFound } from "@tanstack/react-router";
import { DetailPage } from "@/components/public/DetailPage";
import { adminClient } from "@/lib/api/admin-client";
import { advertisementToPublicDetailItem } from "@/lib/advertisements-data";

export const Route = createFileRoute("/advertisements/$slug")({
  loader: async ({ params }) => {
    const res = await adminClient.getPublicAdvertisementBySlug(params.slug);
    if (!res.success || !res.data) {
      throw notFound();
    }
    return advertisementToPublicDetailItem(res.data);
  },
  head: ({ loaderData }) => {
    const title = loaderData?.title ?? "Advertisement";
    return {
      meta: [
        { title: `${title} — CobraLearn` },
        { name: "description", content: loaderData?.description ?? "Explore a CobraLearn campaign." },
        { property: "og:title", content: `${title} — CobraLearn` },
        { property: "og:description", content: loaderData?.description ?? "Explore a CobraLearn campaign." },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary_large_image" },
      ],
    };
  },
  component: () => <DetailPage item={Route.useLoaderData()} type="advertisements" />,
});
