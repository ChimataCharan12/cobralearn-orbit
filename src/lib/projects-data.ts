import type { ProjectWithMedia } from "@/lib/server/projects-operations";
import type { PublishStatus } from "@prisma/client";
import type { ShowcaseItem } from "@/data/showcase";
import projectImage from "@/assets/project-smart-home.jpg";

export type ProjectStatus = "Published" | "Draft" | "Archived";

export interface ProjectItem {
  id: string;
  slug?: string | undefined;
  name: string;
  description: string;
  fullDescription?: string | null | undefined;
  category?: string | undefined;
  technologies: string[];
  extraTechCount?: number | undefined;
  status: ProjectStatus;
  order: number;
  image: string;
  liveUrl?: string | undefined;
  githubUrl?: string | undefined;
  videoUrl?: string | undefined;
  projectDuration?: string | undefined;
  teamSize?: string | undefined;
  featured?: boolean | undefined;
  tags?: string[] | undefined;
  thumbnailId?: string | null | undefined;
  galleryPreviews?: string[] | undefined;
  galleryMediaIds?: string[] | undefined;
}

export const INITIAL_PROJECTS: ProjectItem[] = [];

export function statusToPrisma(status: ProjectStatus): PublishStatus {
  switch (status) {
    case "Published":
      return "PUBLISHED";
    case "Draft":
      return "DRAFT";
    case "Archived":
      return "ARCHIVED";
    default:
      return "DRAFT";
  }
}

export function statusFromPrisma(status: PublishStatus): ProjectStatus {
  switch (status) {
    case "PUBLISHED":
      return "Published";
    case "DRAFT":
      return "Draft";
    case "ARCHIVED":
      return "Archived";
    default:
      return "Draft";
  }
}

export function projectToItem(project: ProjectWithMedia): ProjectItem {
  const galleryPreviews = project.gallery?.map((g) => g.media?.publicUrl).filter(Boolean) as string[] || [];
  const galleryMediaIds = project.gallery?.map((g) => g.mediaId) || [];

  return {
    id: project.id,
    slug: project.slug,
    name: project.name,
    description: project.description,
    fullDescription: project.fullDescription,
    category: project.category,
    technologies: project.technologies || [],
    status: statusFromPrisma(project.status),
    order: project.displayOrder,
    image: project.thumbnail?.publicUrl || projectImage,
    liveUrl: project.liveUrl || undefined,
    githubUrl: project.githubUrl || undefined,
    videoUrl: project.videoUrl || undefined,
    projectDuration: project.projectDuration || undefined,
    teamSize: project.teamSize || undefined,
    featured: project.featured,
    tags: project.tags || [],
    thumbnailId: project.thumbnailId,
    galleryPreviews,
    galleryMediaIds,
  };
}

export function projectToShowcaseItem(project: ProjectWithMedia): ShowcaseItem {
  return {
    id: project.id,
    title: project.name,
    slug: project.slug,
    description: project.description,
    image: project.thumbnail?.publicUrl || projectImage,
    accent: "orange",
    published: project.status === "PUBLISHED",
    order: project.displayOrder,
  };
}

export interface PublicProjectGalleryItem {
  id: string;
  mediaId: string;
  displayOrder: number;
  url: string;
  name?: string | undefined;
  altText?: string | undefined;
}

export interface PublicProjectDetailItem extends ShowcaseItem {
  thumbnailId?: string | null | undefined;
  fullDescription?: string | null | undefined;
  category?: string | undefined;
  projectDuration?: string | null | undefined;
  teamSize?: string | null | undefined;
  technologies: string[];
  tags: string[];
  liveUrl?: string | null | undefined;
  githubUrl?: string | null | undefined;
  videoUrl?: string | null | undefined;
  gallery: PublicProjectGalleryItem[];
}

export function projectToPublicDetailItem(project: ProjectWithMedia): PublicProjectDetailItem {
  const gallery: PublicProjectGalleryItem[] = (project.gallery || [])
    .map((g) => ({
      id: g.id,
      mediaId: g.mediaId,
      displayOrder: g.displayOrder,
      url: g.media?.publicUrl || "",
      name: g.media?.name,
      altText: g.media?.altText || g.media?.name || "",
    }))
    .filter((g) => Boolean(g.url));

  return {
    id: project.id,
    title: project.name,
    slug: project.slug,
    description: project.description,
    fullDescription: project.fullDescription,
    image: project.thumbnail?.publicUrl || "",
    thumbnailId: project.thumbnailId,
    accent: "orange",
    published: project.status === "PUBLISHED",
    order: project.displayOrder,
    category: project.category,
    projectDuration: project.projectDuration,
    teamSize: project.teamSize,
    technologies: project.technologies || [],
    tags: project.tags || [],
    liveUrl: project.liveUrl,
    githubUrl: project.githubUrl,
    videoUrl: project.videoUrl,
    gallery,
  };
}
