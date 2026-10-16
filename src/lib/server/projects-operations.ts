import type { PrismaClient, Project, PublishStatus, MediaAsset } from "@prisma/client";
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

export type ProjectWithMedia = Project & {
  thumbnail?: MediaAsset | null;
  gallery?: Array<{
    id: string;
    mediaId: string;
    displayOrder: number;
    media: MediaAsset;
  }>;
};

export interface CreateProjectPayload {
  name: string;
  slug?: string | undefined;
  description: string;
  fullDescription?: string | null | undefined;
  category?: string | undefined;
  status?: PublishStatus | undefined;
  featured?: boolean | undefined;
  displayOrder?: number | undefined;
  projectDuration?: string | null | undefined;
  teamSize?: string | null | undefined;
  technologies?: string[] | undefined;
  tags?: string[] | undefined;
  liveUrl?: string | null | undefined;
  githubUrl?: string | null | undefined;
  videoUrl?: string | null | undefined;
  thumbnailId?: string | null | undefined;
  galleryMediaIds?: string[] | undefined;
}

export interface UpdateProjectPayload {
  name?: string | undefined;
  slug?: string | undefined;
  description?: string | undefined;
  fullDescription?: string | null | undefined;
  category?: string | undefined;
  status?: PublishStatus | undefined;
  featured?: boolean | undefined;
  displayOrder?: number | undefined;
  projectDuration?: string | null | undefined;
  teamSize?: string | null | undefined;
  technologies?: string[] | undefined;
  tags?: string[] | undefined;
  liveUrl?: string | null | undefined;
  githubUrl?: string | null | undefined;
  videoUrl?: string | null | undefined;
  thumbnailId?: string | null | undefined;
  galleryMediaIds?: string[] | undefined;
}

/**
 * Generates a clean URL slug from a project title.
 */
export function generateSlug(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

const VALID_PUBLISH_STATUSES: Set<string> = new Set(["DRAFT", "PUBLISHED", "ARCHIVED"]);

/**
 * Validates and sanitizes a URL to prevent dangerous schemes (e.g. javascript:, data:, vbscript:).
 */
export function validateSafeUrl(url?: string | null | undefined, fieldName: string = "URL"): string | null {
  if (!url || !url.trim()) return null;
  const trimmed = url.trim();
  const lower = trimmed.toLowerCase();
  if (lower.startsWith("javascript:") || lower.startsWith("data:") || lower.startsWith("vbscript:")) {
    throw new Error(`Validation Error: ${fieldName} cannot use dangerous protocol scheme`);
  }
  return trimmed;
}

/**
 * Sanitizes and validates a string array (e.g. technologies, tags).
 */
export function sanitizeStringArray(
  arr: unknown,
  fieldName: string,
  maxItems = 50,
  maxItemLength = 100
): string[] {
  if (!arr) return [];
  if (!Array.isArray(arr)) {
    throw new Error(`Validation Error: ${fieldName} must be an array of strings`);
  }
  if (arr.length > maxItems) {
    throw new Error(`Validation Error: Maximum of ${maxItems} items allowed for ${fieldName}`);
  }
  const result: string[] = [];
  for (const item of arr) {
    if (typeof item !== "string") {
      throw new Error(`Validation Error: Each item in ${fieldName} must be a string`);
    }
    const trimmed = item.trim();
    if (!trimmed) continue;
    if (trimmed.length > maxItemLength) {
      throw new Error(`Validation Error: Item in ${fieldName} exceeds maximum length of ${maxItemLength} characters`);
    }
    if (!result.includes(trimmed)) {
      result.push(trimmed);
    }
  }
  return result;
}

// =========================================================================
// 1. ADMIN PROTECTED OPERATIONS (RBAC Enforced)
// =========================================================================

/**
 * Lists all projects for administrative management (Includes Drafts & Archived).
 * Requires CMS_READ permission (SUPER_ADMIN, ADMIN, EDITOR).
 */
export async function listAdminProjectsOperation(
  request: Request,
  options?: { status?: PublishStatus | undefined; search?: string | undefined } | undefined,
  prismaClient?: PrismaClient | undefined
): Promise<{ projects: ProjectWithMedia[] }> {
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
    ];
  }

  const projects = await prisma.project.findMany({
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

  return { projects };
}

/**
 * Retrieves a single project by ID or Slug for admin editing.
 * Requires CMS_READ permission.
 */
export async function getAdminProjectByIdOperation(
  request: Request,
  idOrSlug: string,
  prismaClient?: PrismaClient
): Promise<{ project: ProjectWithMedia | null }> {
  await requirePermission(request, AdminPermissions.CMS_READ, prismaClient);
  const prisma = prismaClient || (await getPrisma());

  const project = await prisma.project.findFirst({
    where: {
      OR: [{ id: idOrSlug }, { slug: idOrSlug }],
    },
    include: {
      thumbnail: true,
      gallery: {
        include: { media: true },
        orderBy: { displayOrder: "asc" },
      },
    },
  });

  return { project };
}

/**
 * Validates that referenced thumbnail and gallery media IDs exist in PostgreSQL MediaAsset table
 * and adhere to domain constraints (max 10 gallery images, no duplicate gallery entries).
 */
export async function validateProjectMediaReferences(
  prisma: PrismaClient,
  thumbnailId?: string | null | undefined,
  galleryMediaIds?: string[] | undefined
): Promise<void> {
  if (thumbnailId !== undefined && thumbnailId !== null && thumbnailId.trim()) {
    const thumbAsset = await prisma.mediaAsset.findUnique({
      where: { id: thumbnailId.trim() },
      select: { id: true },
    });
    if (!thumbAsset) {
      throw new Error(`Validation Error: Referenced thumbnail media asset "${thumbnailId}" does not exist`);
    }
  }

  if (galleryMediaIds !== undefined && galleryMediaIds !== null) {
    if (!Array.isArray(galleryMediaIds)) {
      throw new Error("Validation Error: galleryMediaIds must be an array of strings");
    }
    if (galleryMediaIds.length > 10) {
      throw new Error("Validation Error: Maximum of 10 gallery images allowed");
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
        throw new Error(`Validation Error: Referenced gallery media asset(s) not found: ${missing.join(", ")}`);
      }
    }
  }
}

/**
 * Creates a new project in PostgreSQL.
 * Requires CMS_CREATE permission (SUPER_ADMIN, ADMIN, EDITOR).
 */
export async function createAdminProjectOperation(
  request: Request,
  payload: CreateProjectPayload,
  prismaClient?: PrismaClient
): Promise<{ project: ProjectWithMedia }> {
  const context = await requirePermission(request, AdminPermissions.CMS_CREATE, prismaClient);
  const prisma = prismaClient || (await getPrisma());

  // Input Validation
  if (!payload.name || !payload.name.trim()) {
    throw new Error("Validation Error: Project name is required");
  }
  if (payload.name.trim().length > 255) {
    throw new Error("Validation Error: Project name exceeds maximum length of 255 characters");
  }
  if (!payload.description || !payload.description.trim()) {
    throw new Error("Validation Error: Project description is required");
  }
  if (payload.description.trim().length > 1000) {
    throw new Error("Validation Error: Project description exceeds maximum length of 1000 characters");
  }
  if (payload.fullDescription && payload.fullDescription.trim().length > 20000) {
    throw new Error("Validation Error: Full description exceeds maximum length of 20000 characters");
  }

  const name = payload.name.trim();
  const slug = payload.slug?.trim() ? generateSlug(payload.slug) : generateSlug(name);
  if (!slug) {
    throw new Error("Validation Error: Unable to generate a valid slug");
  }

  // Check unique slug conflict
  const existing = await prisma.project.findUnique({ where: { slug } });
  if (existing) {
    throw new Error(`Conflict Error: A project with slug "${slug}" already exists`);
  }

  if (payload.status !== undefined && !VALID_PUBLISH_STATUSES.has(payload.status)) {
    throw new Error("Validation Error: Invalid project status");
  }

  const status: PublishStatus = payload.status || "DRAFT";
  const publishedAt = status === "PUBLISHED" ? new Date() : null;

  const liveUrl = validateSafeUrl(payload.liveUrl, "Live URL");
  const githubUrl = validateSafeUrl(payload.githubUrl, "GitHub URL");
  const videoUrl = validateSafeUrl(payload.videoUrl, "Video URL");
  const technologies = sanitizeStringArray(payload.technologies, "technologies");
  const tags = sanitizeStringArray(payload.tags, "tags");

  // Required thumbnail: A real thumbnail must be selected or uploaded before either Save as Draft or Publish
  if (!payload.thumbnailId || !payload.thumbnailId.trim()) {
    throw new Error("Validation Error: Thumbnail image is required. Please upload or select a cover image from the Media Library.");
  }

  // Validate Media Asset References
  await validateProjectMediaReferences(prisma, payload.thumbnailId, payload.galleryMediaIds);

  // Execute in atomic transaction: create project, create gallery items, record audit log
  const createdProject = await prisma.$transaction(async (tx) => {
    const project = await tx.project.create({
      data: {
        name,
        slug,
        description: payload.description.trim(),
        fullDescription: payload.fullDescription?.trim() || null,
        category: payload.category?.trim() || "",
        status,
        featured: Boolean(payload.featured),
        displayOrder: typeof payload.displayOrder === "number" ? payload.displayOrder : 0,
        projectDuration: payload.projectDuration?.trim() || null,
        teamSize: payload.teamSize?.trim() || null,
        technologies,
        tags,
        liveUrl,
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
          tx.projectGalleryItem.create({
            data: {
              projectId: project.id,
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
        action: "PROJECT_CREATED",
        module: "PROJECTS_CMS",
        entityId: project.id,
        metadata: {
          name: project.name,
          slug: project.slug,
          status: project.status,
        },
      },
    });

    return project;
  });

  // Return complete hydrated project with media relations
  const fullProject = await prisma.project.findUnique({
    where: { id: createdProject.id },
    include: {
      thumbnail: true,
      gallery: {
        include: { media: true },
        orderBy: { displayOrder: "asc" },
      },
    },
  });

  // Dispatch content notification only if created directly as PUBLISHED
  if (createdProject.status === "PUBLISHED") {
    await createNotificationEvent(
      {
        category: "CONTENT_UPDATE",
        title: "Project Published",
        message: `${context.profile.fullName || context.profile.email} published project "${fullProject?.name || payload.name}".`,
        link: "/admin/projects",
        eventKey: `project:published:${createdProject.id}`,
      },
      prismaClient
    );
  }

  return { project: fullProject! };
}

/**
 * Updates an existing project in PostgreSQL.
 * Requires CMS_UPDATE permission (SUPER_ADMIN, ADMIN, EDITOR).
 */
export async function updateAdminProjectOperation(
  request: Request,
  id: string,
  payload: UpdateProjectPayload,
  prismaClient?: PrismaClient
): Promise<{ project: ProjectWithMedia }> {
  const context = await requirePermission(request, AdminPermissions.CMS_UPDATE, prismaClient);
  const prisma = prismaClient || (await getPrisma());

  // Verify project exists
  const existing = await prisma.project.findUnique({ where: { id } });
  if (!existing) {
    throw new Error("Not Found: Project does not exist");
  }

  const updateData: any = {};

  if (payload.name !== undefined) {
    if (!payload.name.trim()) throw new Error("Validation Error: Project name cannot be empty");
    if (payload.name.trim().length > 255) throw new Error("Validation Error: Project name exceeds maximum length of 255 characters");
    updateData.name = payload.name.trim();
  }

  if (payload.slug !== undefined) {
    const newSlug = generateSlug(payload.slug);
    if (!newSlug) throw new Error("Validation Error: Invalid slug format");
    if (newSlug !== existing.slug) {
      const conflict = await prisma.project.findUnique({ where: { slug: newSlug } });
      if (conflict) throw new Error(`Conflict Error: Slug "${newSlug}" is already in use`);
      updateData.slug = newSlug;
    }
  }

  if (payload.description !== undefined) {
    if (!payload.description.trim()) throw new Error("Validation Error: Description cannot be empty");
    if (payload.description.trim().length > 1000) throw new Error("Validation Error: Description exceeds maximum length of 1000 characters");
    updateData.description = payload.description.trim();
  }

  if (payload.fullDescription !== undefined) {
    if (payload.fullDescription && payload.fullDescription.trim().length > 20000) {
      throw new Error("Validation Error: Full description exceeds maximum length of 20000 characters");
    }
    updateData.fullDescription = payload.fullDescription?.trim() || null;
  }
  if (payload.category !== undefined) updateData.category = payload.category.trim();
  if (payload.featured !== undefined) updateData.featured = Boolean(payload.featured);
  if (payload.displayOrder !== undefined) updateData.displayOrder = payload.displayOrder;
  if (payload.projectDuration !== undefined) updateData.projectDuration = payload.projectDuration?.trim() || null;
  if (payload.teamSize !== undefined) updateData.teamSize = payload.teamSize?.trim() || null;
  if (payload.technologies !== undefined) updateData.technologies = sanitizeStringArray(payload.technologies, "technologies");
  if (payload.tags !== undefined) updateData.tags = sanitizeStringArray(payload.tags, "tags");
  if (payload.liveUrl !== undefined) updateData.liveUrl = validateSafeUrl(payload.liveUrl, "Live URL");
  if (payload.githubUrl !== undefined) updateData.githubUrl = validateSafeUrl(payload.githubUrl, "GitHub URL");
  if (payload.videoUrl !== undefined) updateData.videoUrl = validateSafeUrl(payload.videoUrl, "Video URL");

  // Required thumbnail: A real thumbnail is required for both Draft and Publish
  if (payload.thumbnailId !== undefined) {
    if (!payload.thumbnailId || !payload.thumbnailId.trim()) {
      throw new Error("Validation Error: Thumbnail image is required. Please upload or select a cover image from the Media Library.");
    }
    updateData.thumbnailId = payload.thumbnailId.trim();
  } else if (!existing.thumbnailId || !existing.thumbnailId.trim()) {
    throw new Error("Validation Error: Thumbnail image is required. Please upload or select a cover image from the Media Library.");
  }

  if (payload.status !== undefined) {
    if (!VALID_PUBLISH_STATUSES.has(payload.status)) {
      throw new Error("Validation Error: Invalid project status");
    }
    updateData.status = payload.status;
    if (payload.status === "PUBLISHED" && !existing.publishedAt) {
      updateData.publishedAt = new Date();
    }
  }

  // Validate Media Asset References if provided
  await validateProjectMediaReferences(
    prisma,
    updateData.thumbnailId !== undefined ? updateData.thumbnailId : existing.thumbnailId,
    payload.galleryMediaIds
  );

  // Execute update inside transaction
  await prisma.$transaction(async (tx) => {
    await tx.project.update({
      where: { id },
      data: updateData,
    });

    // Re-sync gallery if provided
    if (payload.galleryMediaIds !== undefined) {
      await tx.projectGalleryItem.deleteMany({ where: { projectId: id } });
      if (payload.galleryMediaIds.length > 0) {
        await Promise.all(
          payload.galleryMediaIds.map((mediaId, idx) =>
            tx.projectGalleryItem.create({
              data: {
                projectId: id,
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
        action: "PROJECT_UPDATED",
        module: "PROJECTS_CMS",
        entityId: id,
        metadata: {
          updatedFields: Object.keys(updateData),
          name: updateData.name || existing.name,
          status: updateData.status || existing.status,
        },
      },
    });
  });

  const fullUpdated = await prisma.project.findUnique({
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
    // Transition from DRAFT/ARCHIVED to PUBLISHED: Publication notification
    await createNotificationEvent(
      {
        category: "CONTENT_UPDATE",
        title: "Project Published",
        message: `${context.profile.fullName || context.profile.email} published project "${fullUpdated?.name || existing.name}".`,
        link: "/admin/projects",
        eventKey: `project:published:${id}`,
      },
      prismaClient
    );
  } else if (wasPublished && isNowPublished) {
    // Edit on an already-published project
    await createNotificationEvent(
      {
        category: "CONTENT_UPDATE",
        title: "Project Updated",
        message: `${context.profile.fullName || context.profile.email} updated project "${fullUpdated?.name || existing.name}".`,
        link: "/admin/projects",
      },
      prismaClient
    );
  } else if (wasPublished && isNowArchived) {
    // Transition from PUBLISHED to ARCHIVED: Archive notification
    await createNotificationEvent(
      {
        category: "CONTENT_UPDATE",
        title: "Project Archived",
        message: `${context.profile.fullName || context.profile.email} archived project "${fullUpdated?.name || existing.name}".`,
        link: "/admin/projects",
        eventKey: `project:archived:${id}`,
      },
      prismaClient
    );
  }

  return { project: fullUpdated! };
}

/**
 * Deletes a project from PostgreSQL.
 * Requires CMS_DELETE permission (SUPER_ADMIN and ADMIN only. Prohibited for EDITOR).
 */
export async function deleteAdminProjectOperation(
  request: Request,
  id: string,
  prismaClient?: PrismaClient
): Promise<{ success: boolean; deletedId: string }> {
  const context = await requirePermission(request, AdminPermissions.CMS_DELETE, prismaClient);
  const prisma = prismaClient || (await getPrisma());

  const existing = await prisma.project.findUnique({ where: { id } });
  if (!existing) {
    throw new Error("Not Found: Project does not exist");
  }

  await prisma.$transaction(async (tx) => {
    // Delete project (cascade removes gallery items)
    await tx.project.delete({ where: { id } });

    // Record Audit Log
    await tx.adminAuditLog.create({
      data: {
        actorId: context.profile.id,
        actorEmail: context.profile.email,
        action: "PROJECT_DELETED",
        module: "PROJECTS_CMS",
        entityId: id,
        metadata: {
          name: existing.name,
          slug: existing.slug,
          category: existing.category,
        },
      },
    });
  });

  if (existing.status === "PUBLISHED") {
    await createNotificationEvent(
      {
        category: "CONTENT_UPDATE",
        title: "Project Deleted",
        message: `${context.profile.fullName || context.profile.email} deleted project "${existing.name}".`,
        link: "/admin/projects",
        eventKey: `project:deleted:${id}`,
      },
      prismaClient
    );
  }

  return { success: true, deletedId: id };
}

/**
 * Updates display order indices across multiple projects.
 * Requires CMS_UPDATE permission.
 */
export async function reorderAdminProjectsOperation(
  request: Request,
  orderedIds: string[],
  prismaClient?: PrismaClient
): Promise<{ success: boolean }> {
  const context = await requirePermission(request, AdminPermissions.CMS_UPDATE, prismaClient);
  const prisma = prismaClient || (await getPrisma());

  if (!Array.isArray(orderedIds) || orderedIds.length === 0) {
    throw new Error("Validation Error: orderedIds array is required");
  }

  // Reject duplicate IDs
  const uniqueIds = new Set(orderedIds);
  if (uniqueIds.size !== orderedIds.length) {
    throw new Error("Validation Error: Duplicate project IDs are not allowed in orderedIds");
  }

  // Verify all provided IDs exist in the database
  const existingProjects = await prisma.project.findMany({
    where: { id: { in: orderedIds } },
    select: { id: true },
  });

  if (existingProjects.length !== orderedIds.length) {
    const foundIds = new Set(existingProjects.map((p) => p.id));
    const missingIds = orderedIds.filter((id) => !foundIds.has(id));
    throw new Error(`Validation Error: Unknown project ID(s) provided: ${missingIds.join(", ")}`);
  }

  await prisma.$transaction(async (tx) => {
    await Promise.all(
      orderedIds.map((id, index) =>
        tx.project.update({
          where: { id },
          data: { displayOrder: index + 1 },
        })
      )
    );

    await tx.adminAuditLog.create({
      data: {
        actorId: context.profile.id,
        actorEmail: context.profile.email,
        action: "PROJECTS_REORDERED",
        module: "PROJECTS_CMS",
        entityId: "bulk-reorder",
        metadata: { count: orderedIds.length },
      },
    });
  });

  return { success: true };
}

// =========================================================================
// 2. PUBLIC SHOWCASE OPERATIONS (Strictly Published Only, No Auth Required)
// =========================================================================

/**
 * Public operation to query published projects for the public showcase website.
 * Enforces status: PUBLISHED filter. Drafts & Archived records are strictly excluded.
 */
export async function getPublicProjectsOperation(
  prismaClient?: PrismaClient
): Promise<{ projects: ProjectWithMedia[] }> {
  const prisma = prismaClient || (await getPrisma());

  const projects = await prisma.project.findMany({
    where: {
      status: "PUBLISHED",
    },
    include: {
      thumbnail: true,
      gallery: {
        include: { media: true },
        orderBy: { displayOrder: "asc" },
      },
    },
    orderBy: [{ displayOrder: "asc" }, { createdAt: "desc" }],
  });

  return { projects };
}

/**
 * Public operation to query a single published project by slug.
 * Returns null if the project does not exist OR is in DRAFT/ARCHIVED status.
 */
export async function getPublicProjectBySlugOperation(
  slug: string,
  prismaClient?: PrismaClient
): Promise<{ project: ProjectWithMedia | null }> {
  if (!slug || !slug.trim()) return { project: null };

  const prisma = prismaClient || (await getPrisma());

  const project = await prisma.project.findFirst({
    where: {
      slug: slug.trim(),
      status: "PUBLISHED", // Security invariant: Drafts never leak to public
    },
    include: {
      thumbnail: true,
      gallery: {
        include: { media: true },
        orderBy: { displayOrder: "asc" },
      },
    },
  });

  return { project };
}
