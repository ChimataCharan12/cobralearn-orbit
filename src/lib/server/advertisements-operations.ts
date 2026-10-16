import type { PrismaClient, Advertisement, PublishStatus, MediaAsset, AdvertisementGalleryItem } from "@prisma/client";
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

export type AdvertisementWithMedia = Advertisement & {
  thumbnail?: MediaAsset | null;
  gallery?: (AdvertisementGalleryItem & { media: MediaAsset })[];
};

export interface CreateAdvertisementPayload {
  name: string;
  slug?: string | undefined;
  campaign: string;
  brand: string;
  campaignType?: string | null | undefined;
  description: string;
  fullDescription?: string | null | undefined;
  startDate?: string | null | undefined;
  endDate?: string | null | undefined;
  date?: string | undefined;
  campaignUrl?: string | null | undefined;
  status?: PublishStatus | undefined;
  featured?: boolean | undefined;
  showOnHomepage?: boolean | undefined;
  displayOrder?: number | undefined;
  thumbnailId?: string | null | undefined;
  galleryMediaIds?: string[] | undefined;
}

export interface UpdateAdvertisementPayload {
  name?: string | undefined;
  slug?: string | undefined;
  campaign?: string | undefined;
  brand?: string | undefined;
  campaignType?: string | null | undefined;
  description?: string | undefined;
  fullDescription?: string | null | undefined;
  startDate?: string | null | undefined;
  endDate?: string | null | undefined;
  date?: string | undefined;
  campaignUrl?: string | null | undefined;
  status?: PublishStatus | undefined;
  featured?: boolean | undefined;
  showOnHomepage?: boolean | undefined;
  displayOrder?: number | undefined;
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
 * Validates that the referenced thumbnail MediaAsset exists in the database.
 */
/**
 * Validates that the referenced thumbnail and gallery MediaAssets exist in the database.
 */
async function validateAdvertisementMediaReference(
  prisma: PrismaClient,
  thumbnailId?: string | null,
  galleryMediaIds?: string[] | null
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

  if (galleryMediaIds !== undefined && galleryMediaIds !== null) {
    if (!Array.isArray(galleryMediaIds)) {
      throw new Error("Validation Error: galleryMediaIds must be an array of strings");
    }
    if (galleryMediaIds.length > 5) {
      throw new Error("Validation Error: Maximum of 5 gallery images allowed");
    }
    for (const id of galleryMediaIds) {
      if (typeof id !== "string" || !id.trim()) {
        throw new Error("Validation Error: Each gallery media ID must be a non-empty string");
      }
    }
    const uniqueIds = new Set(galleryMediaIds.map((id) => id.trim()));
    if (uniqueIds.size !== galleryMediaIds.length) {
      throw new Error("Validation Error: Duplicate gallery media items are not permitted");
    }
    if (galleryMediaIds.length > 0) {
      const foundAssets = await prisma.mediaAsset.findMany({
        where: { id: { in: Array.from(uniqueIds) } },
        select: { id: true },
      });
      if (foundAssets.length !== uniqueIds.size) {
        const foundSet = new Set(foundAssets.map((a) => a.id));
        const missing = Array.from(uniqueIds).filter((id) => !foundSet.has(id));
        throw new Error(`Validation Error: Referenced gallery media asset(s) not found in Media Library: ${missing.join(", ")}`);
      }
    }
  }
}

/**
 * Lists all advertisements for administrative management (Includes Drafts & Archived).
 * Requires CMS_READ permission (SUPER_ADMIN, ADMIN, EDITOR).
 */
export async function listAdminAdvertisementsOperation(
  request: Request,
  optionsOrPrisma?: { status?: PublishStatus | undefined; campaign?: string | undefined; search?: string | undefined } | PrismaClient,
  prismaClient?: PrismaClient | undefined
): Promise<{ advertisements: AdvertisementWithMedia[] }> {
  const isPrisma = optionsOrPrisma && ("adminProfile" in optionsOrPrisma || "$transaction" in (optionsOrPrisma as any));
  const prismaInstance = isPrisma ? (optionsOrPrisma as PrismaClient) : prismaClient;
  const options = isPrisma ? undefined : (optionsOrPrisma as { status?: PublishStatus | undefined; campaign?: string | undefined; search?: string | undefined } | undefined);

  await requirePermission(request, AdminPermissions.CMS_READ, prismaInstance);
  const prisma = prismaInstance || (await getPrisma());

  const where: any = {};
  if (options?.status) {
    where.status = options.status;
  }
  if (options?.campaign && options.campaign.trim()) {
    where.campaign = options.campaign.trim();
  }
  if (options?.search && options.search.trim()) {
    const q = options.search.trim();
    where.OR = [
      { name: { contains: q, mode: "insensitive" } },
      { campaign: { contains: q, mode: "insensitive" } },
      { brand: { contains: q, mode: "insensitive" } },
      { description: { contains: q, mode: "insensitive" } },
      { campaignType: { contains: q, mode: "insensitive" } },
    ];
  }

  const advertisements = await prisma.advertisement.findMany({
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

  return { advertisements };
}

/**
 * Retrieves a single advertisement by ID or Slug for admin editing.
 * Requires CMS_READ permission.
 */
export async function getAdminAdvertisementByIdOperation(
  request: Request,
  idOrSlug: string,
  prismaClient?: PrismaClient
): Promise<{ advertisement: AdvertisementWithMedia | null }> {
  await requirePermission(request, AdminPermissions.CMS_READ, prismaClient);
  const prisma = prismaClient || (await getPrisma());

  if (!idOrSlug || !idOrSlug.trim()) {
    return { advertisement: null };
  }

  const advertisement = await prisma.advertisement.findFirst({
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

  return { advertisement };
}

/**
 * Creates a new advertisement in PostgreSQL with audit log.
 * Requires CMS_CREATE permission (SUPER_ADMIN, ADMIN, EDITOR).
 */
export async function createAdminAdvertisementOperation(
  request: Request,
  payload: CreateAdvertisementPayload,
  prismaClient?: PrismaClient
): Promise<{ advertisement: AdvertisementWithMedia }> {
  const context = await requirePermission(request, AdminPermissions.CMS_CREATE, prismaClient);
  const prisma = prismaClient || (await getPrisma());

  if (!payload.name || !payload.name.trim()) {
    throw new Error("Validation Error: Advertisement title is required");
  }
  if (payload.name.trim().length > 255) {
    throw new Error("Validation Error: Advertisement title cannot exceed 255 characters");
  }

  if (!payload.campaign || !payload.campaign.trim()) {
    throw new Error("Validation Error: Campaign name is required");
  }
  if (payload.campaign.trim().length > 255) {
    throw new Error("Validation Error: Campaign name cannot exceed 255 characters");
  }

  if (!payload.brand || !payload.brand.trim()) {
    throw new Error("Validation Error: Brand name is required");
  }
  if (payload.brand.trim().length > 255) {
    throw new Error("Validation Error: Brand name cannot exceed 255 characters");
  }

  if (!payload.description || !payload.description.trim()) {
    throw new Error("Validation Error: Description is required");
  }
  if (payload.description.trim().length > 1000) {
    throw new Error("Validation Error: Description cannot exceed 1000 characters");
  }

  if (payload.fullDescription && payload.fullDescription.trim().length > 20000) {
    throw new Error("Validation Error: Full description cannot exceed 20000 characters");
  }

  // Validate status
  const status: PublishStatus = payload.status || "DRAFT";
  if (!VALID_PUBLISH_STATUSES.includes(status)) {
    throw new Error(`Validation Error: Invalid advertisement status "${status}"`);
  }

  // Mandatory real thumbnail for both Save as Draft and Publish (Rule 2)
  if (!payload.thumbnailId || !payload.thumbnailId.trim()) {
    throw new Error("Validation Error: Thumbnail image is required. Please upload or select a cover image from the Media Library.");
  }
  const thumbnailId = payload.thumbnailId.trim();

  // Validate Campaign URL (optional, but if provided must be safe)
  const campaignUrl = payload.campaignUrl && payload.campaignUrl.trim()
    ? validateSafeUrl(payload.campaignUrl, "Campaign URL")
    : null;

  // Date field handling (date is non-nullable string in schema)
  const date = payload.date && payload.date.trim()
    ? payload.date.trim()
    : payload.startDate && payload.startDate.trim()
      ? payload.startDate.trim()
      : new Date().toLocaleDateString("en-US", { month: "short", year: "numeric" });

  const name = payload.name.trim();
  const rawSlug = payload.slug?.trim() || slugify(name);
  const slug = slugify(rawSlug);

  if (!slug) {
    throw new Error("Validation Error: Unable to generate a valid slug from name");
  }

  // Check unique slug constraint
  const existing = await prisma.advertisement.findFirst({
    where: { slug },
  });
  if (existing) {
    throw new Error(`Conflict: An advertisement with slug "${slug}" already exists`);
  }

  // Validate Media Asset Reference
  await validateAdvertisementMediaReference(prisma, payload.thumbnailId, payload.galleryMediaIds);

  // Execute in atomic transaction: create advertisement, create gallery items, record audit log
  const createdAd = await prisma.$transaction(async (tx) => {
    const ad = await tx.advertisement.create({
      data: {
        name,
        slug,
        campaign: payload.campaign.trim(),
        brand: payload.brand.trim(),
        campaignType: payload.campaignType?.trim() || null,
        description: payload.description.trim(),
        fullDescription: payload.fullDescription?.trim() || null,
        startDate: payload.startDate?.trim() || null,
        endDate: payload.endDate?.trim() || null,
        date,
        campaignUrl,
        status,
        featured: Boolean(payload.featured),
        showOnHomepage: Boolean(payload.showOnHomepage),
        displayOrder: typeof payload.displayOrder === "number" ? payload.displayOrder : 0,
        thumbnailId,
      },
    });

    // Create gallery associations if provided
    if (payload.galleryMediaIds && payload.galleryMediaIds.length > 0) {
      await Promise.all(
        payload.galleryMediaIds.map((mediaId, idx) =>
          tx.advertisementGalleryItem.create({
            data: {
              advertisementId: ad.id,
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
        action: "ADVERTISEMENT_CREATED",
        module: "ADVERTISEMENTS_CMS",
        entityId: ad.id,
        metadata: {
          name: ad.name,
          campaign: ad.campaign,
          brand: ad.brand,
          slug: ad.slug,
          status: ad.status,
          galleryCount: payload.galleryMediaIds?.length || 0,
        },
      },
    });

    return ad;
  });

  // Re-read with relations
  const fullAd = await prisma.advertisement.findUniqueOrThrow({
    where: { id: createdAd.id },
    include: {
      thumbnail: true,
      gallery: {
        include: { media: true },
        orderBy: { displayOrder: "asc" },
      },
    },
  });

  if (createdAd.status === "PUBLISHED") {
    await createNotificationEvent(
      {
        category: "CONTENT_UPDATE",
        title: "Advertisement Published",
        message: `${context.profile.fullName || context.profile.email} published advertisement "${fullAd.name}".`,
        link: "/admin/advertisements",
        eventKey: `advertisement:published:${createdAd.id}`,
      },
      prismaClient
    );
  }

  return { advertisement: fullAd };
}

/**
 * Updates an existing advertisement in PostgreSQL with audit log.
 * Requires CMS_UPDATE permission (SUPER_ADMIN, ADMIN, EDITOR).
 */
export async function updateAdminAdvertisementOperation(
  request: Request,
  id: string,
  payload: UpdateAdvertisementPayload,
  prismaClient?: PrismaClient
): Promise<{ advertisement: AdvertisementWithMedia }> {
  const context = await requirePermission(request, AdminPermissions.CMS_UPDATE, prismaClient);
  const prisma = prismaClient || (await getPrisma());

  const existing = await prisma.advertisement.findUnique({
    where: { id },
  });
  if (!existing) {
    throw new Error(`Not Found: Advertisement with ID "${id}" does not exist`);
  }

  const updateData: any = {};

  if (payload.name !== undefined) {
    if (!payload.name.trim()) {
      throw new Error("Validation Error: Advertisement title cannot be empty");
    }
    if (payload.name.trim().length > 255) {
      throw new Error("Validation Error: Advertisement title cannot exceed 255 characters");
    }
    updateData.name = payload.name.trim();
  }

  if (payload.slug !== undefined) {
    const normalizedSlug = slugify(payload.slug);
    if (!normalizedSlug) {
      throw new Error("Validation Error: Slug cannot be empty");
    }
    if (normalizedSlug !== existing.slug) {
      const conflict = await prisma.advertisement.findFirst({
        where: { slug: normalizedSlug, id: { not: id } },
      });
      if (conflict) {
        throw new Error(`Conflict: An advertisement with slug "${normalizedSlug}" already exists`);
      }
      updateData.slug = normalizedSlug;
    }
  }

  if (payload.campaign !== undefined) {
    if (!payload.campaign.trim()) {
      throw new Error("Validation Error: Campaign name cannot be empty");
    }
    if (payload.campaign.trim().length > 255) {
      throw new Error("Validation Error: Campaign name cannot exceed 255 characters");
    }
    updateData.campaign = payload.campaign.trim();
  }

  if (payload.brand !== undefined) {
    if (!payload.brand.trim()) {
      throw new Error("Validation Error: Brand name cannot be empty");
    }
    if (payload.brand.trim().length > 255) {
      throw new Error("Validation Error: Brand name cannot exceed 255 characters");
    }
    updateData.brand = payload.brand.trim();
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

  if (payload.campaignType !== undefined) {
    updateData.campaignType = payload.campaignType?.trim() || null;
  }

  if (payload.startDate !== undefined) {
    updateData.startDate = payload.startDate?.trim() || null;
  }

  if (payload.endDate !== undefined) {
    updateData.endDate = payload.endDate?.trim() || null;
  }

  if (payload.date !== undefined) {
    updateData.date = payload.date.trim();
  }

  if (payload.campaignUrl !== undefined) {
    updateData.campaignUrl = payload.campaignUrl && payload.campaignUrl.trim()
      ? validateSafeUrl(payload.campaignUrl, "Campaign URL")
      : null;
  }

  if (payload.status !== undefined) {
    if (!VALID_PUBLISH_STATUSES.includes(payload.status)) {
      throw new Error(`Validation Error: Invalid advertisement status "${payload.status}"`);
    }
    updateData.status = payload.status;
  }

  if (payload.featured !== undefined) {
    updateData.featured = Boolean(payload.featured);
  }

  if (payload.showOnHomepage !== undefined) {
    updateData.showOnHomepage = Boolean(payload.showOnHomepage);
  }

  if (payload.displayOrder !== undefined) {
    updateData.displayOrder = payload.displayOrder;
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

  // Validate Media Asset Reference
  await validateAdvertisementMediaReference(prisma, updateData.thumbnailId, payload.galleryMediaIds);

  // Execute in transaction
  await prisma.$transaction(async (tx) => {
    await tx.advertisement.update({
      where: { id },
      data: updateData,
    });

    // Update gallery items if provided
    if (payload.galleryMediaIds !== undefined) {
      await tx.advertisementGalleryItem.deleteMany({
        where: { advertisementId: id },
      });

      if (payload.galleryMediaIds.length > 0) {
        await Promise.all(
          payload.galleryMediaIds.map((mediaId, idx) =>
            tx.advertisementGalleryItem.create({
              data: {
                advertisementId: id,
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
        action: "ADVERTISEMENT_UPDATED",
        module: "ADVERTISEMENTS_CMS",
        entityId: id,
        metadata: {
          changes: Object.keys(updateData),
          hasGalleryUpdate: payload.galleryMediaIds !== undefined,
        },
      },
    });
  });

  const updatedAd = await prisma.advertisement.findUniqueOrThrow({
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
        title: "Advertisement Published",
        message: `${context.profile.fullName || context.profile.email} published advertisement "${updatedAd.name}".`,
        link: "/admin/advertisements",
        eventKey: `advertisement:published:${id}`,
      },
      prismaClient
    );
  } else if (wasPublished && isNowPublished) {
    await createNotificationEvent(
      {
        category: "CONTENT_UPDATE",
        title: "Advertisement Updated",
        message: `${context.profile.fullName || context.profile.email} updated advertisement "${updatedAd.name}".`,
        link: "/admin/advertisements",
      },
      prismaClient
    );
  } else if (wasPublished && isNowArchived) {
    await createNotificationEvent(
      {
        category: "CONTENT_UPDATE",
        title: "Advertisement Archived",
        message: `${context.profile.fullName || context.profile.email} archived advertisement "${updatedAd.name}".`,
        link: "/admin/advertisements",
        eventKey: `advertisement:archived:${id}`,
      },
      prismaClient
    );
  }

  return { advertisement: updatedAd };
}

/**
 * Deletes an advertisement from PostgreSQL.
 * Requires CMS_DELETE permission (SUPER_ADMIN, ADMIN only; rejected for EDITOR).
 */
export async function deleteAdminAdvertisementOperation(
  request: Request,
  id: string,
  prismaClient?: PrismaClient
): Promise<{ success: boolean; deletedId: string }> {
  const context = await requirePermission(request, AdminPermissions.CMS_DELETE, prismaClient);
  const prisma = prismaClient || (await getPrisma());

  const advertisement = await prisma.advertisement.findUnique({
    where: { id },
    select: { id: true, name: true, slug: true, status: true },
  });
  if (!advertisement) {
    throw new Error(`Not Found: Advertisement with ID "${id}" does not exist`);
  }

  await prisma.$transaction(async (tx) => {
    // Delete the advertisement record
    await tx.advertisement.delete({
      where: { id },
    });

    // Record Audit Log
    await tx.adminAuditLog.create({
      data: {
        actorId: context.profile.id,
        actorEmail: context.profile.email,
        action: "ADVERTISEMENT_DELETED",
        module: "ADVERTISEMENTS_CMS",
        entityId: id,
        metadata: {
          deletedAdvertisementName: advertisement.name,
          deletedSlug: advertisement.slug,
        },
      },
    });
  });

  if (advertisement.status === "PUBLISHED") {
    await createNotificationEvent(
      {
        category: "CONTENT_UPDATE",
        title: "Advertisement Deleted",
        message: `${context.profile.fullName || context.profile.email} deleted advertisement "${advertisement.name}".`,
        link: "/admin/advertisements",
        eventKey: `advertisement:deleted:${id}`,
      },
      prismaClient
    );
  }

  return { success: true, deletedId: id };
}

/**
 * Reorders advertisement entries in PostgreSQL using sequential displayOrder values.
 * Requires CMS_UPDATE permission.
 */
export async function reorderAdminAdvertisementsOperation(
  request: Request,
  orderedIds: string[],
  prismaClient?: PrismaClient
): Promise<{ success: boolean }> {
  const context = await requirePermission(request, AdminPermissions.CMS_UPDATE, prismaClient);
  const prisma = prismaClient || (await getPrisma());

  if (!Array.isArray(orderedIds) || orderedIds.length === 0) {
    throw new Error("Validation Error: orderedIds must be a non-empty array of advertisement IDs");
  }

  const uniqueIds = Array.from(new Set(orderedIds));
  if (uniqueIds.length !== orderedIds.length) {
    throw new Error("Validation Error: orderedIds cannot contain duplicate IDs");
  }

  // Verify all IDs exist in database
  const count = await prisma.advertisement.count({
    where: { id: { in: orderedIds } },
  });
  if (count !== orderedIds.length) {
    throw new Error("Validation Error: One or more advertisement IDs in orderedIds do not exist");
  }

  await prisma.$transaction(async (tx) => {
    await Promise.all(
      orderedIds.map((id, index) =>
        tx.advertisement.update({
          where: { id },
          data: { displayOrder: index + 1 },
        })
      )
    );

    await tx.adminAuditLog.create({
      data: {
        actorId: context.profile.id,
        actorEmail: context.profile.email,
        action: "ADVERTISEMENTS_REORDERED",
        module: "ADVERTISEMENTS_CMS",
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
 * Retrieves published advertisements for public showcase display.
 * Unauthenticated (Public Access).
 */
export async function getPublicAdvertisementsOperation(
  prismaClient?: PrismaClient,
  options?: { homepageOnly?: boolean }
): Promise<{ advertisements: AdvertisementWithMedia[] }> {
  const prisma = prismaClient || (await getPrisma());

  const where: any = { status: "PUBLISHED" };
  if (options?.homepageOnly) {
    where.showOnHomepage = true;
  }

  const advertisements = await prisma.advertisement.findMany({
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

  return { advertisements };
}

/**
 * Retrieves a single published advertisement by Slug for public detail viewing.
 * Unauthenticated (Public Access). Fails with null if draft, archived, or non-existent.
 */
export async function getPublicAdvertisementBySlugOperation(
  slug: string,
  prismaClient?: PrismaClient
): Promise<{ advertisement: AdvertisementWithMedia | null }> {
  const prisma = prismaClient || (await getPrisma());

  if (!slug || !slug.trim()) {
    return { advertisement: null };
  }

  const advertisement = await prisma.advertisement.findFirst({
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

  return { advertisement };
}
