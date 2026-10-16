import type { PublishStatus, Advertisement, MediaAsset, AdvertisementGalleryItem } from "@prisma/client";
import type { ShowcaseItem } from "@/data/showcase";
import advertisementImage from "@/assets/advertising-campaign.jpg";

export type AdStatus = "Published" | "Draft" | "Archived";

export type AdvertisementWithMedia = Advertisement & {
  thumbnail?: MediaAsset | null | undefined;
  gallery?: (AdvertisementGalleryItem & { media: MediaAsset })[] | undefined;
};

export interface AdvertisementItem {
  id: string;
  slug: string;
  name: string;
  campaign: string;
  brand: string;
  description: string;
  fullDescription?: string | null | undefined;
  status: AdStatus;
  date: string;
  order: number;
  image: string;
  campaignType?: string | null | undefined;
  startDate?: string | null | undefined;
  endDate?: string | null | undefined;
  campaignUrl?: string | null | undefined;
  featured?: boolean | undefined;
  showOnHomepage?: boolean | undefined;
  thumbnailId?: string | null | undefined;
  galleryMediaIds?: string[] | undefined;
  galleryPreviews?: string[] | undefined;
  gallery?: {
    id: string;
    mediaId: string;
    displayOrder: number;
    media: {
      id: string;
      publicUrl: string;
      name: string;
      altText?: string | null | undefined;
    };
  }[] | undefined;
  createdAt?: string | undefined;
  updatedAt?: string | undefined;
}

export interface PublicAdvertisementDetailItem extends ShowcaseItem {
  campaign: string;
  brand: string;
  fullDescription?: string | null | undefined;
  campaignType?: string | null | undefined;
  startDate?: string | null | undefined;
  endDate?: string | null | undefined;
  date: string;
  campaignUrl?: string | null | undefined;
  liveUrl?: string | null | undefined;
  featured?: boolean | undefined;
  gallery?: {
    id: string;
    url: string;
    altText?: string | null | undefined;
    name?: string | undefined;
  }[] | undefined;
}

export const INITIAL_ADVERTISEMENTS: AdvertisementItem[] = [];

/**
 * Converts UI status string to Prisma PublishStatus enum.
 */
export function statusToPrisma(status: AdStatus): PublishStatus {
  switch (status) {
    case "Published":
      return "PUBLISHED";
    case "Archived":
      return "ARCHIVED";
    case "Draft":
    default:
      return "DRAFT";
  }
}

/**
 * Converts Prisma PublishStatus enum to UI status string.
 */
export function statusFromPrisma(status: PublishStatus): AdStatus {
  switch (status) {
    case "PUBLISHED":
      return "Published";
    case "ARCHIVED":
      return "Archived";
    case "DRAFT":
    default:
      return "Draft";
  }
}

/**
 * Maps a database AdvertisementWithMedia record to a frontend AdvertisementItem.
 */
export function advertisementToItem(ad: AdvertisementWithMedia): AdvertisementItem {
  return {
    id: ad.id,
    slug: ad.slug,
    name: ad.name,
    campaign: ad.campaign,
    brand: ad.brand,
    description: ad.description,
    fullDescription: ad.fullDescription,
    status: statusFromPrisma(ad.status),
    date: ad.date,
    order: ad.displayOrder,
    image: ad.thumbnail?.publicUrl || advertisementImage,
    campaignType: ad.campaignType,
    startDate: ad.startDate,
    endDate: ad.endDate,
    campaignUrl: ad.campaignUrl,
    featured: ad.featured,
    showOnHomepage: ad.showOnHomepage,
    thumbnailId: ad.thumbnailId,
    galleryMediaIds: ad.gallery?.map((g) => g.mediaId) || [],
    galleryPreviews: ad.gallery?.map((g) => g.media?.publicUrl).filter((url): url is string => Boolean(url)) || [],
    gallery: ad.gallery?.map((g) => ({
      id: g.id,
      mediaId: g.mediaId,
      displayOrder: g.displayOrder,
      media: {
        id: g.media?.id || g.mediaId,
        publicUrl: g.media?.publicUrl || "",
        name: g.media?.name || "",
        altText: g.media?.altText || null,
      },
    })),
    createdAt: ad.createdAt ? ad.createdAt.toISOString() : undefined,
    updatedAt: ad.updatedAt ? ad.updatedAt.toISOString() : undefined,
  };
}

/**
 * Maps a database AdvertisementWithMedia record to a public ShowcaseItem.
 */
export function advertisementToShowcaseItem(ad: AdvertisementWithMedia): ShowcaseItem {
  return {
    id: ad.id,
    title: ad.name,
    slug: ad.slug,
    description: ad.description,
    image: ad.thumbnail?.publicUrl || advertisementImage,
    accent: "red",
    published: ad.status === "PUBLISHED",
    order: ad.displayOrder,
  };
}

/**
 * Maps a database AdvertisementWithMedia record to a public detail item.
 */
export function advertisementToPublicDetailItem(ad: AdvertisementWithMedia): PublicAdvertisementDetailItem {
  return {
    id: ad.id,
    title: ad.name,
    slug: ad.slug,
    description: ad.description,
    fullDescription: ad.fullDescription,
    campaign: ad.campaign,
    brand: ad.brand,
    campaignType: ad.campaignType,
    startDate: ad.startDate,
    endDate: ad.endDate,
    date: ad.date,
    campaignUrl: ad.campaignUrl,
    liveUrl: ad.campaignUrl,
    featured: ad.featured,
    image: ad.thumbnail?.publicUrl || advertisementImage,
    gallery: ad.gallery?.map((g) => ({
      id: g.id,
      url: g.media?.publicUrl || "",
      altText: g.media?.altText || null,
      name: g.media?.name || "",
    })).filter((g) => Boolean(g.url)) || [],
    accent: "red",
    published: ad.status === "PUBLISHED",
    order: ad.displayOrder,
  };
}
