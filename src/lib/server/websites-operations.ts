import type { PrismaClient, Website, PublishStatus, MediaAsset } from "@prisma/client";
import { AdminPermissions } from "@/lib/auth/rbac";
import { requirePermission } from "@/lib/auth/server-auth";
import { createNotificationEvent } from "./notification-operations";

let defaultPrisma: PrismaClient | null = null;

async function getPrisma(): Promise<PrismaClient> {
  if (!defaultPrisma) {
    const { PrismaClient } = await import("@prisma/client");
    defaultPrisma = new PrismaClient();
  }
  return defaultPrisma;
}

export type WebsiteWithMedia = Website & {
  thumbnail?: MediaAsset | null;
  gallery?: Array<{
    id: string;
    mediaId: string;
    displayOrder: number;
    media: MediaAsset;
  }>;
};

export interface CreateWebsitePayload {
  name: string;
  slug?: string | undefined;
  url: string;
  description: string;
  fullDescription?: string | null | undefined;
  category?: string | undefined;
  status?: PublishStatus | undefined;
  featured?: boolean | undefined;
  displayOrder?: number | undefined;
  launchDate?: string | null | undefined;
  teamSize?: string | null | undefined;
  technologies?: string[] | undefined;
  tags?: string[] | undefined;
  githubUrl?: string | null | undefined;
  videoUrl?: string | null | undefined;
  thumbnailId?: string | null | undefined;
  galleryMediaIds?: string[] | undefined;
}

export interface UpdateWebsitePayload {
  name?: string | undefined;
  slug?: string | undefined;
  url?: string | undefined;
  description?: string | undefined;
  fullDescription?: string | null | undefined;
  category?: string | undefined;
  status?: PublishStatus | undefined;
  featured?: boolean | undefined;
  displayOrder?: number | undefined;
  launchDate?: string | null | undefined;
  teamSize?: string | null | undefined;
  technologies?: string[] | undefined;
  tags?: string[] | undefined;
  githubUrl?: string | null | undefined;
  videoUrl?: string | null | undefined;
  thumbnailId?: string | null | undefined;
  galleryMediaIds?: string[] | undefined;
}

/**
 * Normalizes title into URL-safe slug.
 */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Validates that an optional or required URL doesn't use dangerous schemes (e.g. javascript:, data:, vbscript:).
 */
export function validateSafeUrl(urlStr: string | null | undefined, fieldName: string): string | null {
  if (!urlStr || !urlStr.trim()) return null;
  let trimmed = urlStr.trim();
  const lower = trimmed.toLowerCase();

  if (
    lower.startsWith("javascript:") ||
    lower.startsWith("data:") ||
    lower.startsWith("vbscript:") ||
    lower.startsWith("file:")
  ) {
    throw new Error(`Validation Error: ${fieldName} cannot use dangerous protocol scheme`);
  }

  // Auto-normalize safe web addresses that lack protocol (e.g. "cobralearn.dev", "www.cobralearn.dev")
  if (!/^https?:\/\//i.test(trimmed)) {
    if (trimmed.includes("://")) {
      throw new Error(`Validation Error: ${fieldName} must use http:// or https:// protocol`);
    }
    trimmed = `https://${trimmed}`;
  }

  try {
    const parsed = new URL(trimmed);
    if (!["http:", "https:"].includes(parsed.protocol)) {
      throw new Error(`Validation Error: ${fieldName} must use http:// or https:// protocol`);
    }
    if (!parsed.hostname || (!parsed.hostname.includes(".") && parsed.hostname !== "localhost")) {
      throw new Error(`Validation Error: ${fieldName} must be a valid URL`);
    }
  } catch (err: unknown) {
    if (err instanceof Error && err.message.startsWith("Validation Error:")) throw err;
    throw new Error(`Validation Error: ${fieldName} must be a valid URL`);
  }

  return trimmed;
}

const VALID_PUBLISH_STATUSES: PublishStatus[] = ["DRAFT", "PUBLISHED", "ARCHIVED"];

/**
 * Sanitizes array of strings with bounded length and non-empty elements.
 */
function sanitizeStringArray(arr: unknown, maxItems = 30, maxItemLength = 60): string[] {
  if (!arr) return [];
  if (!Array.isArray(arr)) {
    throw new Error("Validation Error: Expected an array of strings");
  }
  return arr
    .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    .map((item) => item.trim().slice(0, maxItemLength))
    .slice(0, maxItems);
}

/**
 * Validates that media IDs (thumbnail and gallery) reference genuine assets in the database.
 */
async function validateWebsiteMediaReferences(
  prisma: PrismaClient,
  thumbnailId?: string | null,
  galleryMediaIds?: string[]
): Promise<void> {
  if (thumbnailId && typeof thumbnailId === "string" && thumbnailId.trim()) {
    const thumbAsset = await prisma.mediaAsset.findUnique({
      where: { id: thumbnailId.trim() },
      select: { id: true },
    });
    if (!thumbAsset) {
      throw new Error(`Validation Error: Thumbnail media asset "${thumbnailId}" does not exist in Media Library`);
    }
  }

  if (galleryMediaIds !== undefined) {
    if (!Array.isArray(galleryMediaIds)) {
      throw new Error("Validation Error: Gallery media IDs must be an array of strings");
    }

    if (galleryMediaIds.length > 10) {
      throw new Error("Validation Error: A website cannot exceed 10 gallery screenshots");
    }

    const uniqueIds = new Set<string>();
    for (const id of galleryMediaIds) {
      if (typeof id !== "string" || !id.trim()) {
        throw new Error("Validation Error: Gallery media IDs must be non-empty strings");
      }
      if (uniqueIds.has(id.trim())) {
        throw new Error(`Validation Error: Duplicate media asset "${id}" in gallery`);
      }
      uniqueIds.add(id.trim());
    }

    if (uniqueIds.size > 0) {
      const foundAssets = await prisma.mediaAsset.findMany({
        where: { id: { in: Array.from(uniqueIds) } },
        select: { id: true },
      });
      if (foundAssets.length !== uniqueIds.size) {
        throw new Error("Validation Error: One or more gallery media assets do not exist in Media Library");
      }
    }
  }
}

/**
 * Lists all websites for administrative management (Includes Drafts & Archived).
 * Requires CMS_READ permission (SUPER_ADMIN, ADMIN, EDITOR).
 */
export async function listAdminWebsitesOperation(
  request: Request,
  options?: { status?: PublishStatus | undefined; search?: string | undefined } | undefined,
  prismaClient?: PrismaClient | undefined
): Promise<{ websites: WebsiteWithMedia[] }> {
  await requirePermission(request, AdminPermissions.CMS_READ, prismaClient);
  const prisma = prismaClient || (await getPrisma());

  const where: any = {};
  if (options?.status) {
    where.status = options.status;
  }
  if (options?.search && options.search.trim()) {
    const q = options.search.trim();
    where.OR = [
      { name: { contains: q, mode: "insensitive" } },
      { description: { contains: q, mode: "insensitive" } },
      { category: { contains: q, mode: "insensitive" } },
      { url: { contains: q, mode: "insensitive" } },
    ];
  }

  const websites = await prisma.website.findMany({
    where,
    include: {
      thumbnail: true,
      gallery: {
        include: { media: true },
        orderBy: { displayOrder: "asc" },
      },
    },
    orderBy: [{ displayOrder: "asc" }, { createdAt: "desc" }],
  });

  return { websites };
}

/**
 * Retrieves a single website by ID or Slug for admin editing.
 * Requires CMS_READ permission.
 */
export async function getAdminWebsiteByIdOperation(
  request: Request,
  idOrSlug: string,
  prismaClient?: PrismaClient
): Promise<{ website: WebsiteWithMedia | null }> {
  await requirePermission(request, AdminPermissions.CMS_READ, prismaClient);
  const prisma = prismaClient || (await getPrisma());

  if (!idOrSlug || !idOrSlug.trim()) {
    return { website: null };
  }

  const website = await prisma.website.findFirst({
    where: {
      OR: [{ id: idOrSlug.trim() }, { slug: idOrSlug.trim() }],
    },
    include: {
      thumbnail: true,
      gallery: {
        include: { media: true },
        orderBy: { displayOrder: "asc" },
      },
    },
  });

  return { website };
}

/**
 * Creates a new website in PostgreSQL with gallery associations and audit log.
 * Requires CMS_CREATE permission (SUPER_ADMIN, ADMIN, EDITOR).
 */
export async function createAdminWebsiteOperation(
  request: Request,
  payload: CreateWebsitePayload,
  prismaClient?: PrismaClient
): Promise<{ website: WebsiteWithMedia }> {
  const context = await requirePermission(request, AdminPermissions.CMS_CREATE, prismaClient);
  const prisma = prismaClient || (await getPrisma());

  if (!payload.name || !payload.name.trim()) {
    throw new Error("Validation Error: Website name is required");
  }
  if (payload.name.trim().length > 255) {
    throw new Error("Validation Error: Website name cannot exceed 255 characters");
  }

  if (!payload.description || !payload.description.trim()) {
    throw new Error("Validation Error: Website description is required");
  }
  if (payload.description.trim().length > 1000) {
    throw new Error("Validation Error: Website description cannot exceed 1000 characters");
  }

  if (payload.fullDescription && payload.fullDescription.trim().length > 20000) {
    throw new Error("Validation Error: Full description cannot exceed 20000 characters");
  }

  // Validate status
  const status: PublishStatus = payload.status || "DRAFT";
  if (!VALID_PUBLISH_STATUSES.includes(status)) {
    throw new Error(`Validation Error: Invalid website status "${status}"`);
  }

  // Required thumbnail: A real thumbnail must be selected or uploaded before either Save as Draft or Publish
  if (!payload.thumbnailId || !payload.thumbnailId.trim()) {
    throw new Error("Validation Error: Thumbnail image is required. Please upload or select a cover image from the Media Library.");
  }

  // Validate Live Website URL:
  // - Required when publishing
  // - Optional when saving as draft or archived
  let url = "";
  if (status === "PUBLISHED") {
    if (!payload.url || !payload.url.trim()) {
      throw new Error("Validation Error: Live Website URL is required to publish a website");
    }
    url = validateSafeUrl(payload.url, "Live Website URL")!;
  } else {
    if (payload.url && payload.url.trim()) {
      url = validateSafeUrl(payload.url, "Live Website URL")!;
    } else {
      url = "";
    }
  }

  const name = payload.name.trim();
  const rawSlug = payload.slug?.trim() || slugify(name);
  const slug = slugify(rawSlug);

  if (!slug) {
    throw new Error("Validation Error: Unable to generate a valid slug from name");
  }

  // Check unique slug constraint
  const existing = await prisma.website.findFirst({
    where: { slug },
  });
  if (existing) {
    throw new Error(`Conflict: A website with slug "${slug}" already exists`);
  }

  const publishedAt = status === "PUBLISHED" ? new Date() : null;
  const githubUrl = payload.githubUrl && payload.githubUrl.trim()
    ? validateSafeUrl(payload.githubUrl, "Source Code URL")
    : null;
  const videoUrl = payload.videoUrl && payload.videoUrl.trim()
    ? validateSafeUrl(payload.videoUrl, "Demo Video URL")
    : null;

  const technologies = sanitizeStringArray(payload.technologies);
  const tags = sanitizeStringArray(payload.tags);

  // Validate Media Asset References
  await validateWebsiteMediaReferences(prisma, payload.thumbnailId, payload.galleryMediaIds);

  // Execute in atomic transaction: create website, create gallery items, record audit log
  const createdWebsite = await prisma.$transaction(async (tx) => {
    const website = await tx.website.create({
      data: {
        name,
        slug,
        url,
        description: payload.description.trim(),
        fullDescription: payload.fullDescription?.trim() || null,
        category: payload.category?.trim() || "",
        status,
        featured: Boolean(payload.featured),
        displayOrder: typeof payload.displayOrder === "number" ? payload.displayOrder : 0,
        launchDate: payload.launchDate?.trim() || null,
        teamSize: payload.teamSize?.trim() || null,
        technologies,
        tags,
        githubUrl,
        videoUrl,
        thumbnailId: payload.thumbnailId.trim(),
        publishedAt,
      },
    });

    // Create gallery associations if provided
    if (payload.galleryMediaIds && payload.galleryMediaIds.length > 0) {
      await Promise.all(
        payload.galleryMediaIds.map((mediaId, idx) =>
          tx.websiteGalleryItem.create({
            data: {
              websiteId: website.id,
              mediaId,
              displayOrder: idx,
            },
          })
        )
      );
    }

    // Record Audit Log
    await tx.adminAuditLog.create({
      data: {
        actorId: context.profile.id,
        actorEmail: context.profile.email,
        action: "WEBSITE_CREATED",
        module: "WEBSITES_CMS",
        entityId: website.id,
        metadata: {
          name: website.name,
          slug: website.slug,
          status: website.status,
        },
      },
    });

    return website;
  });

  // Re-read with relations
  const fullWebsite = await prisma.website.findUniqueOrThrow({
    where: { id: createdWebsite.id },
    include: {
      thumbnail: true,
      gallery: {
        include: { media: true },
        orderBy: { displayOrder: "asc" },
      },
    },
  });

  if (createdWebsite.status === "PUBLISHED") {
    await createNotificationEvent(
      {
        category: "CONTENT_UPDATE",
        title: "Website Published",
        message: `${context.profile.fullName || context.profile.email} published website "${fullWebsite.name}".`,
        link: "/admin/websites",
        eventKey: `website:published:${createdWebsite.id}`,
      },
      prismaClient
    );
  }

  return { website: fullWebsite };
}

/**
 * Updates an existing website in PostgreSQL with gallery associations and audit log.
 * Requires CMS_UPDATE permission (SUPER_ADMIN, ADMIN, EDITOR).
 */
export async function updateAdminWebsiteOperation(
  request: Request,
  id: string,
  payload: UpdateWebsitePayload,
  prismaClient?: PrismaClient
): Promise<{ website: WebsiteWithMedia }> {
  const context = await requirePermission(request, AdminPermissions.CMS_UPDATE, prismaClient);
  const prisma = prismaClient || (await getPrisma());

  const existing = await prisma.website.findUnique({
    where: { id },
    include: { gallery: true },
  });
  if (!existing) {
    throw new Error(`Not Found: Website with ID "${id}" does not exist`);
  }

  const updateData: any = {};

  if (payload.name !== undefined) {
    if (!payload.name.trim()) {
      throw new Error("Validation Error: Website name cannot be empty");
    }
    if (payload.name.trim().length > 255) {
      throw new Error("Validation Error: Website name cannot exceed 255 characters");
    }
    updateData.name = payload.name.trim();
  }

  if (payload.slug !== undefined) {
    const normalizedSlug = slugify(payload.slug);
    if (!normalizedSlug) {
      throw new Error("Validation Error: Slug cannot be empty");
    }
    if (normalizedSlug !== existing.slug) {
      const conflict = await prisma.website.findFirst({
        where: { slug: normalizedSlug, id: { not: id } },
      });
      if (conflict) {
        throw new Error(`Conflict: A website with slug "${normalizedSlug}" already exists`);
      }
      updateData.slug = normalizedSlug;
    }
  }

  const targetStatus: PublishStatus = payload.status !== undefined ? payload.status : existing.status;
  if (!VALID_PUBLISH_STATUSES.includes(targetStatus)) {
    throw new Error(`Validation Error: Invalid website status "${targetStatus}"`);
  }

  if (payload.status !== undefined) {
    updateData.status = payload.status;
    if (payload.status === "PUBLISHED" && !existing.publishedAt) {
      updateData.publishedAt = new Date();
    }
  }

  // Validate Live Website URL:
  // - Required when publishing
  // - Optional when saving as draft or archived
  if (payload.url !== undefined) {
    if (targetStatus === "PUBLISHED") {
      if (!payload.url || !payload.url.trim()) {
        throw new Error("Validation Error: Live Website URL is required to publish a website");
      }
      updateData.url = validateSafeUrl(payload.url, "Live Website URL")!;
    } else {
      if (payload.url && payload.url.trim()) {
        updateData.url = validateSafeUrl(payload.url, "Live Website URL")!;
      } else {
        updateData.url = "";
      }
    }
  } else if (targetStatus === "PUBLISHED" && (!existing.url || !existing.url.trim())) {
    throw new Error("Validation Error: Live Website URL is required to publish a website");
  }

  if (payload.description !== undefined) {
    if (!payload.description.trim()) {
      throw new Error("Validation Error: Description cannot be empty");
    }
    if (payload.description.trim().length > 1000) {
      throw new Error("Validation Error: Description cannot exceed 1000 characters");
    }
    updateData.description = payload.description.trim();
  }

  if (payload.fullDescription !== undefined) {
    if (payload.fullDescription && payload.fullDescription.trim().length > 20000) {
      throw new Error("Validation Error: Full description cannot exceed 20000 characters");
    }
    updateData.fullDescription = payload.fullDescription?.trim() || null;
  }

  if (payload.category !== undefined) {
    updateData.category = payload.category.trim();
  }

  if (payload.featured !== undefined) {
    updateData.featured = Boolean(payload.featured);
  }

  if (payload.displayOrder !== undefined) {
    updateData.displayOrder = payload.displayOrder;
  }

  if (payload.launchDate !== undefined) {
    updateData.launchDate = payload.launchDate?.trim() || null;
  }

  if (payload.teamSize !== undefined) {
    updateData.teamSize = payload.teamSize?.trim() || null;
  }

  if (payload.technologies !== undefined) {
    updateData.technologies = sanitizeStringArray(payload.technologies);
  }

  if (payload.tags !== undefined) {
    updateData.tags = sanitizeStringArray(payload.tags);
  }

  if (payload.githubUrl !== undefined) {
    updateData.githubUrl = payload.githubUrl && payload.githubUrl.trim()
      ? validateSafeUrl(payload.githubUrl, "Source Code URL")
      : null;
  }

  if (payload.videoUrl !== undefined) {
    updateData.videoUrl = payload.videoUrl && payload.videoUrl.trim()
      ? validateSafeUrl(payload.videoUrl, "Demo Video URL")
      : null;
  }

  // Required thumbnail: A real thumbnail is required for both Draft and Publish
  if (payload.thumbnailId !== undefined) {
    if (!payload.thumbnailId || !payload.thumbnailId.trim()) {
      throw new Error("Validation Error: Thumbnail image is required. Please upload or select a cover image from the Media Library.");
    }
    updateData.thumbnailId = payload.thumbnailId.trim();
  } else if (!existing.thumbnailId || !existing.thumbnailId.trim()) {
    throw new Error("Validation Error: Thumbnail image is required. Please upload or select a cover image from the Media Library.");
  }

  // Validate Media Asset References
  await validateWebsiteMediaReferences(prisma, updateData.thumbnailId, payload.galleryMediaIds);

  // Execute in transaction
  await prisma.$transaction(async (tx) => {
    await tx.website.update({
      where: { id },
      data: updateData,
    });

    // Sync gallery if provided
    if (payload.galleryMediaIds !== undefined) {
      await tx.websiteGalleryItem.deleteMany({
        where: { websiteId: id },
      });

      if (payload.galleryMediaIds.length > 0) {
        await Promise.all(
          payload.galleryMediaIds.map((mediaId, idx) =>
            tx.websiteGalleryItem.create({
              data: {
                websiteId: id,
                mediaId,
                displayOrder: idx,
              },
            })
          )
        );
      }
    }

    // Record Audit Log
    await tx.adminAuditLog.create({
      data: {
        actorId: context.profile.id,
        actorEmail: context.profile.email,
        action: "WEBSITE_UPDATED",
        module: "WEBSITES_CMS",
        entityId: id,
        metadata: {
          changes: Object.keys(updateData),
          galleryUpdated: payload.galleryMediaIds !== undefined,
        },
      },
    });
  });

  const updatedWebsite = await prisma.website.findUniqueOrThrow({
    where: { id },
    include: {
      thumbnail: true,
      gallery: {
        include: { media: true },
        orderBy: { displayOrder: "asc" },
      },
    },
  });

  const wasPublished = existing.status === "PUBLISHED";
  const newStatus = updateData.status !== undefined ? updateData.status : existing.status;
  const isNowPublished = newStatus === "PUBLISHED";
  const isNowArchived = newStatus === "ARCHIVED";

  if (!wasPublished && isNowPublished) {
    await createNotificationEvent(
      {
        category: "CONTENT_UPDATE",
        title: "Website Published",
        message: `${context.profile.fullName || context.profile.email} published website "${updatedWebsite.name}".`,
        link: "/admin/websites",
        eventKey: `website:published:${id}`,
      },
      prismaClient
    );
  } else if (wasPublished && isNowPublished) {
    await createNotificationEvent(
      {
        category: "CONTENT_UPDATE",
        title: "Website Updated",
        message: `${context.profile.fullName || context.profile.email} updated website "${updatedWebsite.name}".`,
        link: "/admin/websites",
      },
      prismaClient
    );
  } else if (wasPublished && isNowArchived) {
    await createNotificationEvent(
      {
        category: "CONTENT_UPDATE",
        title: "Website Archived",
        message: `${context.profile.fullName || context.profile.email} archived website "${updatedWebsite.name}".`,
        link: "/admin/websites",
        eventKey: `website:archived:${id}`,
      },
      prismaClient
    );
  }

  return { website: updatedWebsite };
}

/**
 * Deletes a website from PostgreSQL.
 * Requires CMS_DELETE permission (SUPER_ADMIN, ADMIN only; rejected for EDITOR).
 */
export async function deleteAdminWebsiteOperation(
  request: Request,
  id: string,
  prismaClient?: PrismaClient
): Promise<{ success: boolean; deletedId: string }> {
  const context = await requirePermission(request, AdminPermissions.CMS_DELETE, prismaClient);
  const prisma = prismaClient || (await getPrisma());

  const website = await prisma.website.findUnique({
    where: { id },
    select: { id: true, name: true, slug: true, status: true },
  });
  if (!website) {
    throw new Error(`Not Found: Website with ID "${id}" does not exist`);
  }

  await prisma.$transaction(async (tx) => {
    // Delete cascading gallery associations
    await tx.websiteGalleryItem.deleteMany({
      where: { websiteId: id },
    });

    // Delete the website record
    await tx.website.delete({
      where: { id },
    });

    // Record Audit Log
    await tx.adminAuditLog.create({
      data: {
        actorId: context.profile.id,
        actorEmail: context.profile.email,
        action: "WEBSITE_DELETED",
        module: "WEBSITES_CMS",
        entityId: id,
        metadata: {
          deletedWebsiteName: website.name,
          deletedSlug: website.slug,
        },
      },
    });
  });

  if (website.status === "PUBLISHED") {
    await createNotificationEvent(
      {
        category: "CONTENT_UPDATE",
        title: "Website Deleted",
        message: `${context.profile.fullName || context.profile.email} deleted website "${website.name}".`,
        link: "/admin/websites",
        eventKey: `website:deleted:${id}`,
      },
      prismaClient
    );
  }

  return { success: true, deletedId: id };
}

/**
 * Reorders website entries in PostgreSQL using sequential displayOrder values.
 * Requires CMS_UPDATE permission.
 */
export async function reorderAdminWebsitesOperation(
  request: Request,
  orderedIds: string[],
  prismaClient?: PrismaClient
): Promise<{ success: boolean }> {
  const context = await requirePermission(request, AdminPermissions.CMS_UPDATE, prismaClient);
  const prisma = prismaClient || (await getPrisma());

  if (!Array.isArray(orderedIds) || orderedIds.length === 0) {
    throw new Error("Validation Error: orderedIds must be a non-empty array of website IDs");
  }

  const uniqueIds = Array.from(new Set(orderedIds));
  if (uniqueIds.length !== orderedIds.length) {
    throw new Error("Validation Error: orderedIds cannot contain duplicate IDs");
  }

  // Verify all IDs exist in database
  const count = await prisma.website.count({
    where: { id: { in: orderedIds } },
  });
  if (count !== orderedIds.length) {
    throw new Error("Validation Error: One or more website IDs in orderedIds do not exist");
  }

  await prisma.$transaction(async (tx) => {
    await Promise.all(
      orderedIds.map((id, index) =>
        tx.website.update({
          where: { id },
          data: { displayOrder: index + 1 },
        })
      )
    );

    await tx.adminAuditLog.create({
      data: {
        actorId: context.profile.id,
        actorEmail: context.profile.email,
        action: "WEBSITES_REORDERED",
        module: "WEBSITES_CMS",
        metadata: {
          count: orderedIds.length,
          orderedIds,
        },
      },
    });
  });

  return { success: true };
}

/**
 * Retrieves all published websites for public showcase display.
 * Unauthenticated (Public Access).
 */
export async function getPublicWebsitesOperation(
  prismaClient?: PrismaClient
): Promise<{ websites: WebsiteWithMedia[] }> {
  const prisma = prismaClient || (await getPrisma());

  const websites = await prisma.website.findMany({
    where: { status: "PUBLISHED" },
    include: {
      thumbnail: true,
      gallery: {
        include: { media: true },
        orderBy: { displayOrder: "asc" },
      },
    },
    orderBy: [{ displayOrder: "asc" }, { createdAt: "desc" }],
  });

  return { websites };
}

/**
 * Retrieves a single published website by Slug for public detail viewing.
 * Unauthenticated (Public Access). Fails with null if draft, archived, or non-existent.
 */
export async function getPublicWebsiteBySlugOperation(
  slug: string,
  prismaClient?: PrismaClient
): Promise<{ website: WebsiteWithMedia | null }> {
  const prisma = prismaClient || (await getPrisma());

  if (!slug || !slug.trim()) {
    return { website: null };
  }

  const website = await prisma.website.findFirst({
    where: {
      slug: slug.trim(),
      status: "PUBLISHED",
    },
    include: {
      thumbnail: true,
      gallery: {
        include: { media: true },
        orderBy: { displayOrder: "asc" },
      },
    },
  });

  return { website };
}
