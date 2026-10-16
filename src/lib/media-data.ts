import thumbAd from "@/assets/thumb-ad.jpg";
import thumbAward from "@/assets/thumb-award.jpg";
import thumbProject from "@/assets/thumb-project.jpg";
import thumbWebsite from "@/assets/thumb-website.jpg";
import emblem from "@/assets/cobralearn-emblem.png";
import env from "@/assets/cobralearn-admin-environment.jpg";
import type {
  MediaCategory as PrismaMediaCategory,
} from "@prisma/client";

export type MediaType = "Image" | "Video" | "Document" | "Others";
export type MediaCategory = "Advertisements" | "Websites" | "Awards" | "Projects" | "General";

export interface MediaItem {
  id: string;
  name: string;
  type: MediaType;
  category: MediaCategory;
  size: string;
  rawSize?: number;
  date: string;
  thumbnail?: string;
  duration?: string;
  dimensions?: string;
  url?: string;
  description?: string;
  tags?: string[];
  altText?: string;
  visibility?: string;
  usageRights?: string;
  mimeType?: string;
  createdAt?: string;
}

export type MediaAsset = MediaItem;

export const INITIAL_MEDIA_ITEMS: MediaItem[] = [];

export const PRISMA_CATEGORY_TO_UI: Record<string, MediaCategory> = {
  ADVERTISEMENTS: "Advertisements",
  WEBSITES: "Websites",
  AWARDS: "Awards",
  PROJECTS: "Projects",
  GENERAL: "General",
  Advertisements: "Advertisements",
  Websites: "Websites",
  Awards: "Awards",
  Projects: "Projects",
  General: "General",
};

export const UI_CATEGORY_TO_PRISMA: Record<MediaCategory, PrismaMediaCategory> = {
  Advertisements: "ADVERTISEMENTS",
  Websites: "WEBSITES",
  Awards: "AWARDS",
  Projects: "PROJECTS",
  General: "GENERAL",
};

export const PRISMA_TYPE_TO_UI: Record<string, MediaType> = {
  IMAGE: "Image",
  VIDEO: "Video",
  DOCUMENT: "Document",
  OTHER: "Others",
  Image: "Image",
  Video: "Video",
  Document: "Document",
  Others: "Others",
};

export function mapPrismaCategoryToUi(category?: string | null): MediaCategory {
  if (!category) return "General";
  return PRISMA_CATEGORY_TO_UI[category] ?? "General";
}

export function mapPrismaTypeToUi(mediaType?: string | null): MediaType {
  if (!mediaType) return "Others";
  return PRISMA_TYPE_TO_UI[mediaType] ?? "Others";
}

export function formatBytes(bytes: number): string {
  if (bytes <= 0) return "0 MB";
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  if (bytes < 1024 * 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

export function formatMediaDate(createdAt?: Date | string | null): string {
  if (!createdAt) return "Today";
  try {
    const d = new Date(createdAt);
    if (isNaN(d.getTime())) return "Today";
    const now = new Date();
    if (d.toDateString() === now.toDateString()) return "Today";
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  } catch {
    return "Today";
  }
}

export interface PrismaMediaAssetInput {
  id: string;
  name: string;
  mimeType: string;
  fileSize: bigint | number;
  publicUrl: string;
  category: string;
  mediaType?: string | null;
  dimensions?: string | null;
  duration?: string | null;
  altText?: string | null;
  description?: string | null;
  tags?: string[];
  createdAt?: Date | string;
}

/**
 * Maps a Prisma MediaAsset (server response) to the UI MediaItem shape.
 * Uses persistent publicUrl for url/thumbnail — never forwards transient blob: URLs.
 */
export function prismaAssetToMediaItem(
  asset: PrismaMediaAssetInput,
  formState?: {
    fileType?: MediaType;
    visibility?: string;
    usageRights?: string;
  }
): MediaItem {
  const sizeBytes = Number(asset.fileSize);
  const sizeDisplay =
    sizeBytes < 1024 * 1024
      ? `${(sizeBytes / 1024).toFixed(1)} KB`
      : `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`;

  const resolvedType: MediaType = formState?.fileType ?? mapPrismaTypeToUi(asset.mediaType);
  const persistentUrl = asset.publicUrl || undefined;

  return {
    id: asset.id,
    name: asset.name,
    type: resolvedType,
    category: mapPrismaCategoryToUi(asset.category),
    size: sizeDisplay,
    rawSize: sizeBytes,
    date: formatMediaDate(asset.createdAt),
    ...(persistentUrl ? { url: persistentUrl } : {}),
    ...(persistentUrl && resolvedType === "Image"
      ? { thumbnail: persistentUrl }
      : {}),
    ...(asset.dimensions ? { dimensions: asset.dimensions } : {}),
    ...(asset.duration ? { duration: asset.duration } : {}),
    description: asset.description ?? "",
    tags: asset.tags ?? [],
    altText: asset.altText ?? "",
    visibility: formState?.visibility ?? "Private (Admin Only)",
    usageRights: formState?.usageRights ?? "Internal Use",
    mimeType: asset.mimeType,
    createdAt:
      asset.createdAt instanceof Date
        ? asset.createdAt.toISOString()
        : (asset.createdAt ?? new Date().toISOString()),
  };
}
