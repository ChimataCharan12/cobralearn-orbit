import type { PublishStatus, Award, MediaAsset, AwardGalleryItem } from "@prisma/client";
import type { ShowcaseItem } from "@/data/showcase";
import awardImage from "@/assets/awards-trophies.jpg";

export type AwardStatus = "Published" | "Draft" | "Archived";

export type AwardWithMedia = Award & {
  thumbnail?: MediaAsset | null | undefined;
  gallery?: (AwardGalleryItem & { media: MediaAsset })[] | undefined;
};

export interface AwardItem {
  id: string;
  slug: string;
  name: string;
  context: string;
  organization: string;
  category: string;
  date: string;
  status: AwardStatus;
  order: number;
  description: string;
  fullDescription?: string | null | undefined;
  credentialUrl?: string | null | undefined;
  image: string;
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

export interface PublicAwardDetailItem extends ShowcaseItem {
  context: string;
  organization: string;
  category: string;
  date: string;
  fullDescription?: string | null | undefined;
  credentialUrl?: string | null | undefined;
  gallery?: {
    id: string;
    url: string;
    altText?: string | null | undefined;
    name?: string | undefined;
  }[] | undefined;
}

export const INITIAL_AWARDS: AwardItem[] = [];

/**
 * Converts UI status string to Prisma PublishStatus enum.
 */
export function statusToPrisma(status: AwardStatus): PublishStatus {
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
export function statusFromPrisma(status: PublishStatus): AwardStatus {
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
 * Maps a database AwardWithMedia record to a frontend AwardItem.
 */
export function awardToItem(award: AwardWithMedia): AwardItem {
  return {
    id: award.id,
    slug: award.slug,
    name: award.name,
    context: award.context,
    organization: award.organization,
    category: award.category,
    date: award.date,
    status: statusFromPrisma(award.status),
    order: award.displayOrder,
    description: award.description,
    fullDescription: award.fullDescription,
    credentialUrl: award.credentialUrl,
    image: award.thumbnail?.publicUrl || awardImage,
    showOnHomepage: award.showOnHomepage,
    thumbnailId: award.thumbnailId,
    galleryMediaIds: award.gallery?.map((g) => g.mediaId) || [],
    galleryPreviews: award.gallery?.map((g) => g.media?.publicUrl).filter((url): url is string => Boolean(url)) || [],
    gallery: award.gallery?.map((g) => ({
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
    createdAt: award.createdAt ? award.createdAt.toISOString() : undefined,
    updatedAt: award.updatedAt ? award.updatedAt.toISOString() : undefined,
  };
}

/**
 * Maps a database AwardWithMedia record to a public ShowcaseItem.
 */
export function awardToShowcaseItem(award: AwardWithMedia): ShowcaseItem {
  return {
    id: award.id,
    title: award.name,
    slug: award.slug,
    description: award.description,
    image: award.thumbnail?.publicUrl || awardImage,
    accent: "gold",
    published: award.status === "PUBLISHED",
    order: award.displayOrder,
  };
}

/**
 * Maps a database AwardWithMedia record to a public detail item.
 */
export function awardToPublicDetailItem(award: AwardWithMedia): PublicAwardDetailItem {
  return {
    id: award.id,
    title: award.name,
    slug: award.slug,
    description: award.description,
    fullDescription: award.fullDescription,
    context: award.context,
    organization: award.organization,
    category: award.category,
    date: award.date,
    credentialUrl: award.credentialUrl,
    image: award.thumbnail?.publicUrl || awardImage,
    gallery: award.gallery?.map((g) => ({
      id: g.id,
      url: g.media?.publicUrl || "",
      altText: g.media?.altText || null,
      name: g.media?.name || "",
    })).filter((g) => Boolean(g.url)) || [],
    accent: "gold",
    published: award.status === "PUBLISHED",
    order: award.displayOrder,
  };
}
