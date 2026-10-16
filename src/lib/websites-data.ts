import type { PublishStatus, Website } from "@prisma/client";
import type { MediaAsset } from "@prisma/client";
import type { ShowcaseItem } from "@/data/showcase";
import websiteImage from "@/assets/website-learning.jpg";

export type WebsiteStatus = "Published" | "Draft" | "Archived";

export type WebsiteWithMedia = Website & {
  thumbnail?: MediaAsset | null;
  gallery?: Array<{
    id: string;
    mediaId: string;
    displayOrder: number;
    media: MediaAsset;
  }>;
};

export interface WebsiteGalleryItemDisplay {
  id: string;
  mediaId: string;
  displayOrder: number;
  url: string;
  name: string;
  altText?: string;
}

export interface WebsiteItem {
  id: string;
  slug: string;
  name: string;
  url: string;
  description: string;
  fullDescription?: string | null;
  category: string;
  status: WebsiteStatus;
  featured: boolean;
  order: number;
  launchDate?: string;
  teamSize?: string;
  technologies: string[];
  tags: string[];
  githubUrl?: string;
  videoUrl?: string;
  thumbnailId?: string | null;
  image: string;
  gallery: WebsiteGalleryItemDisplay[];
  extraTechCount?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface PublicWebsiteDetailItem extends ShowcaseItem {
  fullDescription?: string | null;
  category: string;
  url: string;
  liveUrl: string;
  githubUrl?: string | null;
  videoUrl?: string | null;
  launchDate?: string | null;
  teamSize?: string | null;
  technologies: string[];
  tags: string[];
  gallery: Array<{
    id: string;
    url: string;
    name?: string;
    altText?: string;
  }>;
}

export const INITIAL_WEBSITES: WebsiteItem[] = [];

/**
 * Converts UI status string to Prisma PublishStatus enum.
 */
export function statusToPrisma(status: WebsiteStatus): PublishStatus {
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
export function statusFromPrisma(status: PublishStatus): WebsiteStatus {
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
 * Maps a database WebsiteWithMedia record to a frontend WebsiteItem.
 */
export function websiteToItem(w: WebsiteWithMedia): WebsiteItem {
  const gallery: WebsiteGalleryItemDisplay[] = (w.gallery || []).map((item) => ({
    id: item.id,
    mediaId: item.mediaId,
    displayOrder: item.displayOrder,
    url: item.media?.publicUrl || "",
    name: item.media?.name || "",
    altText: item.media?.altText || undefined,
  }));

  return {
    id: w.id,
    slug: w.slug,
    name: w.name,
    url: w.url,
    description: w.description,
    fullDescription: w.fullDescription,
    category: w.category || "",
    status: statusFromPrisma(w.status),
    featured: w.featured,
    order: w.displayOrder,
    launchDate: w.launchDate || undefined,
    teamSize: w.teamSize || undefined,
    technologies: w.technologies || [],
    tags: w.tags || [],
    githubUrl: w.githubUrl || undefined,
    videoUrl: w.videoUrl || undefined,
    thumbnailId: w.thumbnailId,
    image: w.thumbnail?.publicUrl || websiteImage,
    gallery,
    extraTechCount: Math.max(0, (w.technologies || []).length - 3),
    createdAt: w.createdAt ? w.createdAt.toISOString() : undefined,
    updatedAt: w.updatedAt ? w.updatedAt.toISOString() : undefined,
  };
}

/**
 * Maps a database WebsiteWithMedia record to a public ShowcaseItem.
 */
export function websiteToShowcaseItem(w: WebsiteWithMedia): ShowcaseItem {
  return {
    id: w.id,
    title: w.name,
    slug: w.slug,
    description: w.description,
    image: w.thumbnail?.publicUrl || websiteImage,
    accent: "green",
    published: w.status === "PUBLISHED",
    order: w.displayOrder,
  };
}

/**
 * Maps a database WebsiteWithMedia record to a public detail item.
 */
export function websiteToPublicDetailItem(w: WebsiteWithMedia): PublicWebsiteDetailItem {
  return {
    id: w.id,
    title: w.name,
    slug: w.slug,
    description: w.description,
    fullDescription: w.fullDescription,
    category: w.category || "WEBSITES",
    image: w.thumbnail?.publicUrl || websiteImage,
    accent: "green",
    published: w.status === "PUBLISHED",
    order: w.displayOrder,
    url: w.url,
    liveUrl: w.url,
    githubUrl: w.githubUrl,
    videoUrl: w.videoUrl,
    launchDate: w.launchDate,
    teamSize: w.teamSize,
    technologies: w.technologies || [],
    tags: w.tags || [],
    gallery: (w.gallery || []).map((item) => ({
      id: item.id,
      url: item.media?.publicUrl || "",
      name: item.media?.name || undefined,
      altText: item.media?.altText || undefined,
    })),
  };
}
