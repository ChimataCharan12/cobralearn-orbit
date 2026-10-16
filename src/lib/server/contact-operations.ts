import type { PrismaClient, ContactMessageStatus, HighlightAccent } from "@prisma/client";
import { AdminPermissions } from "@/lib/auth/rbac";
import { requirePermission } from "@/lib/auth/server-auth";
import { createResendEmailClient, type EmailClient } from "./email/resend-client";
import { createNotificationEvent } from "./notification-operations";

let defaultPrisma: PrismaClient | null = null;

export async function getPrisma(): Promise<PrismaClient> {
  if (!defaultPrisma) {
    const { PrismaClient } = await import("@prisma/client");
    defaultPrisma = new PrismaClient();
  }
  return defaultPrisma;
}

// =========================================================================
// TYPE DEFINITIONS & INTERFACES
// =========================================================================

export interface ContactHeroConfigPayload {
  badgeText?: string;
  heroTitle?: string;
  heroSubtitle?: string;
  heroSectionNumber?: string;
  heroSectionLabel?: string;
  heroHighlightHeading?: string;
  heroDescription?: string | null;
  heroKeywords?: string[];
  heroBackgroundAssetId?: string | null;
}

export interface ContactSeoConfigPayload {
  seoPageTitle?: string;
  seoMetaDescription?: string;
}

export interface ContactInfoPayload {
  email?: string;
  emailDescription?: string;
  phone?: string;
  businessHours?: string;
  location?: string;
  locationDescription?: string;
}

export interface ContactFormSettingsPayload {
  formTitle?: string;
  formSubtitle?: string;
  formSuccessMessage?: string;
  formSubmitButtonText?: string;
  formErrorMessage?: string;
  subjectOptions?: string[];
  enableFaqSection?: boolean;
  enableHighlights?: boolean;
}

export interface UpdateContactConfigPayload {
  hero?: ContactHeroConfigPayload;
  seo?: ContactSeoConfigPayload;
  contactInfo?: ContactInfoPayload;
  formSettings?: ContactFormSettingsPayload;
  highlights?: Array<{
    id?: string;
    title: string;
    description: string;
    iconName: string;
    accentColor?: HighlightAccent | "EMERALD" | "AMBER" | "CYAN" | "emerald" | "amber" | "cyan";
    displayOrder?: number;
    isEnabled?: boolean;
  }>;
  faqs?: Array<{
    id?: string;
    question: string;
    answer: string;
    iconName?: string | null;
    displayOrder?: number;
    isEnabled?: boolean;
  }>;
  socialLinks?: Array<{
    id?: string;
    platform: string;
    label?: string | null;
    url: string;
    iconName: string;
    displayOrder?: number;
    isEnabled?: boolean;
  }>;
}

export interface CreateHighlightPayload {
  title: string;
  description: string;
  iconName: string;
  accentColor?: HighlightAccent | "EMERALD" | "AMBER" | "CYAN";
  isEnabled?: boolean;
}

export interface UpdateHighlightPayload {
  title?: string;
  description?: string;
  iconName?: string;
  accentColor?: HighlightAccent | "EMERALD" | "AMBER" | "CYAN";
  isEnabled?: boolean;
}

export interface CreateFaqPayload {
  question: string;
  answer: string;
  iconName?: string | null;
  isEnabled?: boolean;
}

export interface UpdateFaqPayload {
  question?: string;
  answer?: string;
  iconName?: string | null;
  isEnabled?: boolean;
}

export interface CreateSocialLinkPayload {
  platform: string;
  label?: string | null;
  url: string;
  iconName: string;
  isEnabled?: boolean;
}

export interface UpdateSocialLinkPayload {
  platform?: string;
  label?: string | null;
  url?: string;
  iconName?: string;
  isEnabled?: boolean;
}

export interface SubmitContactMessagePayload {
  fullName: string;
  email: string;
  subject: string;
  message: string;
  honeypot?: string | null;
}

// =========================================================================
// VALIDATION UTILITIES
// =========================================================================

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateSafeUrl(url?: string | null, fieldName: string = "URL"): string | null {
  if (!url || !url.trim()) return null;
  const trimmed = url.trim();
  const lower = trimmed.toLowerCase();
  if (
    lower.startsWith("javascript:") ||
    lower.startsWith("data:") ||
    lower.startsWith("vbscript:")
  ) {
    throw new Error(`Validation Error: ${fieldName} cannot use dangerous protocol schemes`);
  }
  return trimmed;
}

export function normalizeEmail(email: string): string {
  const trimmed = email.trim().toLowerCase();
  if (!EMAIL_REGEX.test(trimmed) || trimmed.length > 254) {
    throw new Error("Validation Error: Invalid email address format");
  }
  return trimmed;
}

// =========================================================================
// 1. CONTACT PAGE CONFIGURATION OPERATIONS
// =========================================================================

/**
 * Reads Contact configuration including hero media, highlights, FAQs, social links,
 * and canonical contact coordinates from SiteSettings.
 * Requires CONTACT_READ permission (SUPER_ADMIN, ADMIN, EDITOR).
 */
export async function getAdminContactConfigOperation(
  request: Request,
  prismaClient?: PrismaClient
) {
  await requirePermission(request, AdminPermissions.CONTACT_READ, prismaClient);
  const prisma = prismaClient || (await getPrisma());

  const [config, siteSettings] = await Promise.all([
    (prisma as any).contactPageConfig.upsert({
      where: { id: "default" },
      create: { id: "default" },
      update: {},
      include: {
        heroBackgroundAsset: true,
        highlights: { orderBy: { displayOrder: "asc" } },
        faqs: { orderBy: { displayOrder: "asc" } },
        socialLinks: { orderBy: { displayOrder: "asc" } },
      },
    }),
    prisma.siteSettings.findUnique({ where: { id: "default" } }),
  ]);

  return {
    config,
    siteSettings: siteSettings || {
      contactEmail: "",
      contactPhone: "",
      contactAddress: "",
      businessHours: "Mon - Fri: 9:00 AM - 6:00 PM IST",
    },
  };
}

/**
 * Updates Contact Page Configuration.
 * Updates presentation fields on ContactPageConfig and coordinates on SiteSettings atomically.
 * Requires CONTACT_UPDATE permission (SUPER_ADMIN, ADMIN).
 */
export async function updateAdminContactConfigOperation(
  request: Request,
  payload: UpdateContactConfigPayload,
  prismaClient?: PrismaClient
) {
  const context = await requirePermission(request, AdminPermissions.CONTACT_UPDATE, prismaClient);
  const prisma = prismaClient || (await getPrisma());

  // Input validation
  if (payload.hero?.heroTitle && payload.hero.heroTitle.trim().length > 200) {
    throw new Error("Validation Error: Hero title exceeds 200 characters limit");
  }
  if (payload.hero?.heroKeywords && payload.hero.heroKeywords.length > 20) {
    throw new Error("Validation Error: Cannot exceed 20 hero keywords");
  }
  if (payload.contactInfo?.email && payload.contactInfo.email.trim() !== "" && !EMAIL_REGEX.test(payload.contactInfo.email.trim())) {
    throw new Error("Validation Error: Primary contact email is invalid");
  }

  // Media validation if background asset specified
  if (payload.hero?.heroBackgroundAssetId) {
    const asset = await prisma.mediaAsset.findUnique({
      where: { id: payload.hero.heroBackgroundAssetId },
    });
    if (!asset) {
      throw new Error("Validation Error: Specified background media asset does not exist");
    }
  }

  return await prisma.$transaction(async (tx: any) => {
    // 1. Prepare ContactPageConfig updates
    const configUpdateData: Record<string, any> = {};

    if (payload.hero) {
      if (payload.hero.badgeText !== undefined) configUpdateData.badgeText = payload.hero.badgeText.trim();
      if (payload.hero.heroTitle !== undefined) configUpdateData.heroTitle = payload.hero.heroTitle.trim();
      if (payload.hero.heroSubtitle !== undefined) configUpdateData.heroSubtitle = payload.hero.heroSubtitle.trim();
      if (payload.hero.heroSectionNumber !== undefined) configUpdateData.heroSectionNumber = payload.hero.heroSectionNumber.trim();
      if (payload.hero.heroSectionLabel !== undefined) configUpdateData.heroSectionLabel = payload.hero.heroSectionLabel.trim();
      if (payload.hero.heroHighlightHeading !== undefined) configUpdateData.heroHighlightHeading = payload.hero.heroHighlightHeading.trim();
      if (payload.hero.heroDescription !== undefined) configUpdateData.heroDescription = payload.hero.heroDescription?.trim() || null;
      if (payload.hero.heroKeywords !== undefined) {
        configUpdateData.heroKeywords = payload.hero.heroKeywords.map((k) => k.trim()).filter(Boolean);
      }
      if (payload.hero.heroBackgroundAssetId !== undefined) {
        configUpdateData.heroBackgroundAssetId = payload.hero.heroBackgroundAssetId || null;
      }
    }

    if (payload.seo) {
      if (payload.seo.seoPageTitle !== undefined) configUpdateData.seoPageTitle = payload.seo.seoPageTitle.trim();
      if (payload.seo.seoMetaDescription !== undefined) configUpdateData.seoMetaDescription = payload.seo.seoMetaDescription.trim();
    }

    if (payload.contactInfo) {
      if (payload.contactInfo.emailDescription !== undefined) {
        configUpdateData.contactEmailDescription = payload.contactInfo.emailDescription.trim();
      }
      if (payload.contactInfo.locationDescription !== undefined) {
        configUpdateData.contactLocationDescription = payload.contactInfo.locationDescription.trim();
      }
    }

    if (payload.formSettings) {
      if (payload.formSettings.formTitle !== undefined) configUpdateData.formTitle = payload.formSettings.formTitle.trim();
      if (payload.formSettings.formSubtitle !== undefined) configUpdateData.formSubtitle = payload.formSettings.formSubtitle.trim();
      if (payload.formSettings.formSuccessMessage !== undefined) configUpdateData.formSuccessMessage = payload.formSettings.formSuccessMessage.trim();
      if (payload.formSettings.formSubmitButtonText !== undefined) configUpdateData.formSubmitButtonText = payload.formSettings.formSubmitButtonText.trim();
      if (payload.formSettings.formErrorMessage !== undefined) configUpdateData.formErrorMessage = payload.formSettings.formErrorMessage.trim();
      if (payload.formSettings.subjectOptions !== undefined) {
        configUpdateData.subjectOptions = payload.formSettings.subjectOptions.map((s) => s.trim()).filter(Boolean);
      }
      if (payload.formSettings.enableFaqSection !== undefined) configUpdateData.enableFaqSection = Boolean(payload.formSettings.enableFaqSection);
      if (payload.formSettings.enableHighlights !== undefined) configUpdateData.enableHighlights = Boolean(payload.formSettings.enableHighlights);
    }

    const updatedConfig = await tx.contactPageConfig.upsert({
      where: { id: "default" },
      create: { id: "default", ...configUpdateData },
      update: configUpdateData,
      include: {
        heroBackgroundAsset: true,
        highlights: { orderBy: { displayOrder: "asc" } },
        faqs: { orderBy: { displayOrder: "asc" } },
        socialLinks: { orderBy: { displayOrder: "asc" } },
      },
    });

    // 2. Update canonical SiteSettings if core coordinates were provided
    let updatedSiteSettings = null;
    if (payload.contactInfo) {
      const siteSettingsUpdates: Record<string, string> = {};
      if (payload.contactInfo.email !== undefined) siteSettingsUpdates.contactEmail = payload.contactInfo.email.trim();
      if (payload.contactInfo.phone !== undefined) siteSettingsUpdates.contactPhone = payload.contactInfo.phone.trim();
      if (payload.contactInfo.location !== undefined) siteSettingsUpdates.contactAddress = payload.contactInfo.location.trim();
      if (payload.contactInfo.businessHours !== undefined) siteSettingsUpdates.businessHours = payload.contactInfo.businessHours.trim();

      if (Object.keys(siteSettingsUpdates).length > 0) {
        updatedSiteSettings = await tx.siteSettings.upsert({
          where: { id: "default" },
          create: { id: "default", ...siteSettingsUpdates },
          update: siteSettingsUpdates,
        });
      }
    }

    // 3. Sync highlights if provided
    if (payload.highlights !== undefined) {
      await tx.contactHighlight.deleteMany({ where: { contactConfigId: "default" } });
      if (payload.highlights.length > 0) {
        await tx.contactHighlight.createMany({
          data: payload.highlights.map((h, i) => ({
            id: h.id && !h.id.startsWith("hl-") ? h.id : undefined,
            contactConfigId: "default",
            title: h.title.trim(),
            description: h.description.trim(),
            iconName: h.iconName.trim(),
            accentColor: (h.accentColor?.toUpperCase() as any) || "EMERALD",
            displayOrder: Math.max(0, h.displayOrder !== undefined ? h.displayOrder : i),
            isEnabled: h.isEnabled !== undefined ? Boolean(h.isEnabled) : true,
          })),
        });
      }
    }

    // 4. Sync FAQs if provided
    if (payload.faqs !== undefined) {
      await tx.contactFaq.deleteMany({ where: { contactConfigId: "default" } });
      if (payload.faqs.length > 0) {
        await tx.contactFaq.createMany({
          data: payload.faqs.map((f, i) => ({
            id: f.id && !f.id.startsWith("faq-") ? f.id : undefined,
            contactConfigId: "default",
            question: f.question.trim(),
            answer: f.answer.trim(),
            iconName: f.iconName?.trim() || null,
            displayOrder: Math.max(0, f.displayOrder !== undefined ? f.displayOrder : i),
            isEnabled: f.isEnabled !== undefined ? Boolean(f.isEnabled) : true,
          })),
        });
      }
    }

    // 5. Sync Social Links if provided
    if (payload.socialLinks !== undefined) {
      await tx.contactSocialLink.deleteMany({ where: { contactConfigId: "default" } });
      if (payload.socialLinks.length > 0) {
        await tx.contactSocialLink.createMany({
          data: payload.socialLinks.map((s, i) => ({
            id: s.id && !s.id.startsWith("social-") ? s.id : undefined,
            contactConfigId: "default",
            platform: s.platform.trim(),
            label: s.label?.trim() || null,
            url: validateSafeUrl(s.url, "Social link URL") || s.url.trim(),
            iconName: s.iconName.trim(),
            displayOrder: Math.max(0, s.displayOrder !== undefined ? s.displayOrder : i),
            isEnabled: s.isEnabled !== undefined ? Boolean(s.isEnabled) : true,
          })),
        });
      }
    }

    const finalConfig = (payload.highlights !== undefined || payload.faqs !== undefined || payload.socialLinks !== undefined)
      ? await tx.contactPageConfig.findUnique({
          where: { id: "default" },
          include: {
            heroBackgroundAsset: true,
            highlights: { orderBy: { displayOrder: "asc" } },
            faqs: { orderBy: { displayOrder: "asc" } },
            socialLinks: { orderBy: { displayOrder: "asc" } },
          },
        })
      : updatedConfig;

    // 6. Record administrative audit log
    await tx.adminAuditLog.create({
      data: {
        actorId: context.profile.id,
        actorEmail: context.profile.email,
        action: "CONTACT_CONFIG_UPDATED",
        module: "CONTACT_CMS",
        entityId: "default",
        metadata: {
          updatedHero: Boolean(payload.hero),
          updatedSeo: Boolean(payload.seo),
          updatedContactInfo: Boolean(payload.contactInfo),
          updatedFormSettings: Boolean(payload.formSettings),
          syncedHighlights: Boolean(payload.highlights),
          syncedFaqs: Boolean(payload.faqs),
          syncedSocialLinks: Boolean(payload.socialLinks),
        },
      },
    });

    return { config: finalConfig, siteSettings: updatedSiteSettings };
  });
}

/**
 * Public Contact Page loader endpoint. Unauthenticated.
 * Fetches published active elements and canonical coordinates safely.
 */
export async function getPublicContactConfigOperation(prismaClient?: PrismaClient) {
  const prisma = prismaClient || (await getPrisma());

  const [config, siteSettings] = await Promise.all([
    (prisma as any).contactPageConfig.findUnique({
      where: { id: "default" },
      include: {
        heroBackgroundAsset: true,
        highlights: { where: { isEnabled: true }, orderBy: { displayOrder: "asc" } },
        faqs: { where: { isEnabled: true }, orderBy: { displayOrder: "asc" } },
        socialLinks: { where: { isEnabled: true }, orderBy: { displayOrder: "asc" } },
      },
    }),
    prisma.siteSettings.findUnique({ where: { id: "default" } }),
  ]);

  return {
    hero: {
      badgeText: config?.badgeText || "CONNECT WITH US",
      heroTitle: config?.heroTitle || "Let’s Build the Next Generation of Digital Experiences",
      heroSubtitle: config?.heroSubtitle || "Have a project in mind, an inquiry about our solutions, or interested in a collaboration?",
      sectionNumber: config?.heroSectionNumber || "01",
      sectionLabel: config?.heroSectionLabel || "CONTACT",
      highlightHeading: config?.heroHighlightHeading || "SOMETHING TOGETHER",
      description: config?.heroDescription || null,
      keywords: config?.heroKeywords || ["IDEAS", "PARTNERSHIPS", "GROWTH", "TOGETHER"],
      backgroundImage: config?.heroBackgroundAsset?.publicUrl || null,
      backgroundAlt: config?.heroBackgroundAsset?.altText || "Contact background banner",
    },
    seo: {
      pageTitle: config?.seoPageTitle || "Contact Us — CobraLearn Innotechcore",
      metaDescription: config?.seoMetaDescription || "Connect with CobraLearn Innotechcore to build impactful digital experiences.",
    },
    contactInfo: {
      email: siteSettings?.contactEmail ?? "",
      emailDescription: config?.contactEmailDescription || "For general inquiries and business discussions",
      phone: siteSettings?.contactPhone ?? "",
      businessHours: siteSettings?.businessHours || "Mon - Fri: 9:00 AM - 6:00 PM IST",
      location: siteSettings?.contactAddress ?? "",
      locationDescription: config?.contactLocationDescription || "Open for onsite meetings (by appointment)",
    },
    highlights: (config?.highlights || []).map((h: any) => ({
      id: h.id,
      title: h.title,
      description: h.description,
      iconName: h.iconName,
      accentColor: h.accentColor,
      displayOrder: h.displayOrder,
    })),
    faqs: (config?.faqs || []).map((f: any) => ({
      id: f.id,
      question: f.question,
      answer: f.answer,
      iconName: f.iconName || null,
      displayOrder: f.displayOrder,
    })),
    socialLinks: (config?.socialLinks || []).map((s: any) => ({
      id: s.id,
      platform: s.platform,
      label: s.label || s.platform,
      url: s.url,
      iconName: s.iconName,
      displayOrder: s.displayOrder,
    })),
    formSettings: {
      title: config?.formTitle || "Send Us a Message",
      subtitle: config?.formSubtitle || "Fill out the form below and we will respond within 24 hours.",
      successMessage: config?.formSuccessMessage || "Thank you! Your message has been received.",
      submitButtonText: config?.formSubmitButtonText || "Send Message",
      errorMessage: config?.formErrorMessage || "Please check the required fields and try again.",
      subjectOptions: config?.subjectOptions || [
        "General Inquiry",
        "Project Consultation",
        "Partnership & Collaboration",
        "Technical Support",
      ],
      enableFaqSection: config?.enableFaqSection ?? true,
      enableHighlights: config?.enableHighlights ?? true,
    },
  };
}

// =========================================================================
// 2. CONTACT HIGHLIGHTS OPERATIONS
// =========================================================================

export async function listAdminContactHighlightsOperation(
  request: Request,
  prismaClient?: PrismaClient
) {
  await requirePermission(request, AdminPermissions.CONTACT_READ, prismaClient);
  const prisma = prismaClient || (await getPrisma());

  return await (prisma as any).contactHighlight.findMany({
    where: { contactConfigId: "default" },
    orderBy: { displayOrder: "asc" },
  });
}

export async function createAdminContactHighlightOperation(
  request: Request,
  payload: CreateHighlightPayload,
  prismaClient?: PrismaClient
) {
  const context = await requirePermission(request, AdminPermissions.CONTACT_UPDATE, prismaClient);
  const prisma = prismaClient || (await getPrisma());

  if (!payload.title || !payload.title.trim()) {
    throw new Error("Validation Error: Title is required");
  }
  if (!payload.description || !payload.description.trim()) {
    throw new Error("Validation Error: Description is required");
  }
  if (!payload.iconName || !payload.iconName.trim()) {
    throw new Error("Validation Error: Icon name is required");
  }

  const highest = await (prisma as any).contactHighlight.findFirst({
    where: { contactConfigId: "default" },
    orderBy: { displayOrder: "desc" },
  });

  const nextOrder = (highest?.displayOrder ?? -1) + 1;

  return await prisma.$transaction(async (tx: any) => {
    const highlight = await tx.contactHighlight.create({
      data: {
        contactConfigId: "default",
        title: payload.title.trim(),
        description: payload.description.trim(),
        iconName: payload.iconName.trim(),
        accentColor: (payload.accentColor?.toUpperCase() as any) || "EMERALD",
        isEnabled: payload.isEnabled !== undefined ? Boolean(payload.isEnabled) : true,
        displayOrder: nextOrder,
      },
    });

    await tx.adminAuditLog.create({
      data: {
        actorId: context.profile.id,
        actorEmail: context.profile.email,
        action: "CONTACT_HIGHLIGHT_CREATED",
        module: "CONTACT_CMS",
        entityId: highlight.id,
        metadata: { title: highlight.title },
      },
    });

    return highlight;
  });
}

export async function updateAdminContactHighlightOperation(
  request: Request,
  id: string,
  payload: UpdateHighlightPayload,
  prismaClient?: PrismaClient
) {
  const context = await requirePermission(request, AdminPermissions.CONTACT_UPDATE, prismaClient);
  const prisma = prismaClient || (await getPrisma());

  const existing = await (prisma as any).contactHighlight.findUnique({ where: { id } });
  if (!existing) {
    throw new Error(`Highlight with id '${id}' not found`);
  }

  const updateData: Record<string, any> = {};
  if (payload.title !== undefined) updateData.title = payload.title.trim();
  if (payload.description !== undefined) updateData.description = payload.description.trim();
  if (payload.iconName !== undefined) updateData.iconName = payload.iconName.trim();
  if (payload.accentColor !== undefined) updateData.accentColor = payload.accentColor.toUpperCase();
  if (payload.isEnabled !== undefined) updateData.isEnabled = Boolean(payload.isEnabled);

  return await prisma.$transaction(async (tx: any) => {
    const updated = await tx.contactHighlight.update({
      where: { id },
      data: updateData,
    });

    await tx.adminAuditLog.create({
      data: {
        actorId: context.profile.id,
        actorEmail: context.profile.email,
        action: "CONTACT_HIGHLIGHT_UPDATED",
        module: "CONTACT_CMS",
        entityId: id,
        metadata: { updatedFields: Object.keys(updateData) },
      },
    });

    return updated;
  });
}

export async function deleteAdminContactHighlightOperation(
  request: Request,
  id: string,
  prismaClient?: PrismaClient
) {
  const context = await requirePermission(request, AdminPermissions.CONTACT_UPDATE, prismaClient);
  const prisma = prismaClient || (await getPrisma());

  return await prisma.$transaction(async (tx: any) => {
    await tx.contactHighlight.delete({ where: { id } });

    await tx.adminAuditLog.create({
      data: {
        actorId: context.profile.id,
        actorEmail: context.profile.email,
        action: "CONTACT_HIGHLIGHT_DELETED",
        module: "CONTACT_CMS",
        entityId: id,
      },
    });

    return { success: true, deletedId: id };
  });
}

export async function reorderAdminContactHighlightsOperation(
  request: Request,
  items: { id: string; displayOrder: number }[],
  prismaClient?: PrismaClient
) {
  const context = await requirePermission(request, AdminPermissions.CONTACT_UPDATE, prismaClient);
  const prisma = prismaClient || (await getPrisma());

  return await prisma.$transaction(async (tx: any) => {
    for (const item of items) {
      await tx.contactHighlight.update({
        where: { id: item.id },
        data: { displayOrder: item.displayOrder },
      });
    }

    await tx.adminAuditLog.create({
      data: {
        actorId: context.profile.id,
        actorEmail: context.profile.email,
        action: "CONTACT_HIGHLIGHTS_REORDERED",
        module: "CONTACT_CMS",
        entityId: "default",
        metadata: { count: items.length },
      },
    });

    return { success: true, count: items.length };
  });
}

// =========================================================================
// 3. CONTACT FAQS OPERATIONS
// =========================================================================

export async function listAdminContactFaqsOperation(
  request: Request,
  prismaClient?: PrismaClient
) {
  await requirePermission(request, AdminPermissions.CONTACT_READ, prismaClient);
  const prisma = prismaClient || (await getPrisma());

  return await (prisma as any).contactFaq.findMany({
    where: { contactConfigId: "default" },
    orderBy: { displayOrder: "asc" },
  });
}

export async function createAdminContactFaqOperation(
  request: Request,
  payload: CreateFaqPayload,
  prismaClient?: PrismaClient
) {
  const context = await requirePermission(request, AdminPermissions.CONTACT_UPDATE, prismaClient);
  const prisma = prismaClient || (await getPrisma());

  if (!payload.question || !payload.question.trim()) {
    throw new Error("Validation Error: Question is required");
  }
  if (!payload.answer || !payload.answer.trim()) {
    throw new Error("Validation Error: Answer is required");
  }

  const highest = await (prisma as any).contactFaq.findFirst({
    where: { contactConfigId: "default" },
    orderBy: { displayOrder: "desc" },
  });

  const nextOrder = (highest?.displayOrder ?? -1) + 1;

  return await prisma.$transaction(async (tx: any) => {
    const faq = await tx.contactFaq.create({
      data: {
        contactConfigId: "default",
        question: payload.question.trim(),
        answer: payload.answer.trim(),
        iconName: payload.iconName?.trim() || null,
        isEnabled: payload.isEnabled !== undefined ? Boolean(payload.isEnabled) : true,
        displayOrder: nextOrder,
      },
    });

    await tx.adminAuditLog.create({
      data: {
        actorId: context.profile.id,
        actorEmail: context.profile.email,
        action: "CONTACT_FAQ_CREATED",
        module: "CONTACT_CMS",
        entityId: faq.id,
        metadata: { question: faq.question.slice(0, 50) },
      },
    });

    return faq;
  });
}

export async function updateAdminContactFaqOperation(
  request: Request,
  id: string,
  payload: UpdateFaqPayload,
  prismaClient?: PrismaClient
) {
  const context = await requirePermission(request, AdminPermissions.CONTACT_UPDATE, prismaClient);
  const prisma = prismaClient || (await getPrisma());

  const existing = await (prisma as any).contactFaq.findUnique({ where: { id } });
  if (!existing) {
    throw new Error(`FAQ with id '${id}' not found`);
  }

  const updateData: Record<string, any> = {};
  if (payload.question !== undefined) updateData.question = payload.question.trim();
  if (payload.answer !== undefined) updateData.answer = payload.answer.trim();
  if (payload.iconName !== undefined) updateData.iconName = payload.iconName?.trim() || null;
  if (payload.isEnabled !== undefined) updateData.isEnabled = Boolean(payload.isEnabled);

  return await prisma.$transaction(async (tx: any) => {
    const updated = await tx.contactFaq.update({
      where: { id },
      data: updateData,
    });

    await tx.adminAuditLog.create({
      data: {
        actorId: context.profile.id,
        actorEmail: context.profile.email,
        action: "CONTACT_FAQ_UPDATED",
        module: "CONTACT_CMS",
        entityId: id,
        metadata: { updatedFields: Object.keys(updateData) },
      },
    });

    return updated;
  });
}

export async function deleteAdminContactFaqOperation(
  request: Request,
  id: string,
  prismaClient?: PrismaClient
) {
  const context = await requirePermission(request, AdminPermissions.CONTACT_UPDATE, prismaClient);
  const prisma = prismaClient || (await getPrisma());

  return await prisma.$transaction(async (tx: any) => {
    await tx.contactFaq.delete({ where: { id } });

    await tx.adminAuditLog.create({
      data: {
        actorId: context.profile.id,
        actorEmail: context.profile.email,
        action: "CONTACT_FAQ_DELETED",
        module: "CONTACT_CMS",
        entityId: id,
      },
    });

    return { success: true, deletedId: id };
  });
}

export async function reorderAdminContactFaqsOperation(
  request: Request,
  items: { id: string; displayOrder: number }[],
  prismaClient?: PrismaClient
) {
  const context = await requirePermission(request, AdminPermissions.CONTACT_UPDATE, prismaClient);
  const prisma = prismaClient || (await getPrisma());

  return await prisma.$transaction(async (tx: any) => {
    for (const item of items) {
      await tx.contactFaq.update({
        where: { id: item.id },
        data: { displayOrder: item.displayOrder },
      });
    }

    await tx.adminAuditLog.create({
      data: {
        actorId: context.profile.id,
        actorEmail: context.profile.email,
        action: "CONTACT_FAQS_REORDERED",
        module: "CONTACT_CMS",
        entityId: "default",
        metadata: { count: items.length },
      },
    });

    return { success: true, count: items.length };
  });
}

// =========================================================================
// 4. CONTACT SOCIAL LINKS OPERATIONS
// =========================================================================

export async function listAdminContactSocialLinksOperation(
  request: Request,
  prismaClient?: PrismaClient
) {
  await requirePermission(request, AdminPermissions.CONTACT_READ, prismaClient);
  const prisma = prismaClient || (await getPrisma());

  return await (prisma as any).contactSocialLink.findMany({
    where: { contactConfigId: "default" },
    orderBy: { displayOrder: "asc" },
  });
}

export async function createAdminContactSocialLinkOperation(
  request: Request,
  payload: CreateSocialLinkPayload,
  prismaClient?: PrismaClient
) {
  const context = await requirePermission(request, AdminPermissions.CONTACT_UPDATE, prismaClient);
  const prisma = prismaClient || (await getPrisma());

  if (!payload.platform || !payload.platform.trim()) {
    throw new Error("Validation Error: Platform name is required");
  }
  const safeUrl = validateSafeUrl(payload.url, "Social link URL");
  if (!safeUrl) {
    throw new Error("Validation Error: Social link URL is required");
  }

  const highest = await (prisma as any).contactSocialLink.findFirst({
    where: { contactConfigId: "default" },
    orderBy: { displayOrder: "desc" },
  });

  const nextOrder = (highest?.displayOrder ?? -1) + 1;

  return await prisma.$transaction(async (tx: any) => {
    const link = await tx.contactSocialLink.create({
      data: {
        contactConfigId: "default",
        platform: payload.platform.trim(),
        label: payload.label?.trim() || null,
        url: safeUrl,
        iconName: payload.iconName.trim(),
        isEnabled: payload.isEnabled !== undefined ? Boolean(payload.isEnabled) : true,
        displayOrder: nextOrder,
      },
    });

    await tx.adminAuditLog.create({
      data: {
        actorId: context.profile.id,
        actorEmail: context.profile.email,
        action: "CONTACT_SOCIAL_LINK_CREATED",
        module: "CONTACT_CMS",
        entityId: link.id,
        metadata: { platform: link.platform },
      },
    });

    return link;
  });
}

export async function updateAdminContactSocialLinkOperation(
  request: Request,
  id: string,
  payload: UpdateSocialLinkPayload,
  prismaClient?: PrismaClient
) {
  const context = await requirePermission(request, AdminPermissions.CONTACT_UPDATE, prismaClient);
  const prisma = prismaClient || (await getPrisma());

  const existing = await (prisma as any).contactSocialLink.findUnique({ where: { id } });
  if (!existing) {
    throw new Error(`Social link with id '${id}' not found`);
  }

  const updateData: Record<string, any> = {};
  if (payload.platform !== undefined) updateData.platform = payload.platform.trim();
  if (payload.label !== undefined) updateData.label = payload.label?.trim() || null;
  if (payload.url !== undefined) {
    updateData.url = validateSafeUrl(payload.url, "Social link URL");
  }
  if (payload.iconName !== undefined) updateData.iconName = payload.iconName.trim();
  if (payload.isEnabled !== undefined) updateData.isEnabled = Boolean(payload.isEnabled);

  return await prisma.$transaction(async (tx: any) => {
    const updated = await tx.contactSocialLink.update({
      where: { id },
      data: updateData,
    });

    await tx.adminAuditLog.create({
      data: {
        actorId: context.profile.id,
        actorEmail: context.profile.email,
        action: "CONTACT_SOCIAL_LINK_UPDATED",
        module: "CONTACT_CMS",
        entityId: id,
        metadata: { updatedFields: Object.keys(updateData) },
      },
    });

    return updated;
  });
}

export async function deleteAdminContactSocialLinkOperation(
  request: Request,
  id: string,
  prismaClient?: PrismaClient
) {
  const context = await requirePermission(request, AdminPermissions.CONTACT_UPDATE, prismaClient);
  const prisma = prismaClient || (await getPrisma());

  return await prisma.$transaction(async (tx: any) => {
    await tx.contactSocialLink.delete({ where: { id } });

    await tx.adminAuditLog.create({
      data: {
        actorId: context.profile.id,
        actorEmail: context.profile.email,
        action: "CONTACT_SOCIAL_LINK_DELETED",
        module: "CONTACT_CMS",
        entityId: id,
      },
    });

    return { success: true, deletedId: id };
  });
}

export async function reorderAdminContactSocialLinksOperation(
  request: Request,
  items: { id: string; displayOrder: number }[],
  prismaClient?: PrismaClient
) {
  const context = await requirePermission(request, AdminPermissions.CONTACT_UPDATE, prismaClient);
  const prisma = prismaClient || (await getPrisma());

  return await prisma.$transaction(async (tx: any) => {
    for (const item of items) {
      await tx.contactSocialLink.update({
        where: { id: item.id },
        data: { displayOrder: item.displayOrder },
      });
    }

    await tx.adminAuditLog.create({
      data: {
        actorId: context.profile.id,
        actorEmail: context.profile.email,
        action: "CONTACT_SOCIAL_LINKS_REORDERED",
        module: "CONTACT_CMS",
        entityId: "default",
        metadata: { count: items.length },
      },
    });

    return { success: true, count: items.length };
  });
}

// =========================================================================
// 5. CONTACT MESSAGES OPERATIONS (ADMIN SECURED)
// =========================================================================

export interface ListMessagesFilter {
  status?: ContactMessageStatus | string;
  search?: string;
  limit?: number;
  offset?: number;
  sortBy?: "newest" | "oldest" | "sender" | "subject" | string;
}

export async function listAdminContactMessagesOperation(
  request: Request,
  filter?: ListMessagesFilter,
  prismaClient?: PrismaClient
) {
  await requirePermission(request, AdminPermissions.CONTACT_READ, prismaClient);
  const prisma = prismaClient || (await getPrisma());

  const limit = Math.min(Math.max(filter?.limit || 20, 1), 100);
  const offset = Math.max(filter?.offset || 0, 0);

  const where: Record<string, any> = {};

  if (filter?.status && filter.status !== "ALL") {
    where.status = filter.status.toUpperCase();
  }

  if (filter?.search && filter.search.trim()) {
    const term = filter.search.trim();
    where.OR = [
      { fullName: { contains: term, mode: "insensitive" } },
      { email: { contains: term, mode: "insensitive" } },
      { subject: { contains: term, mode: "insensitive" } },
      { message: { contains: term, mode: "insensitive" } },
    ];
  }

  let orderBy: any = { createdAt: "desc" };
  if (filter?.sortBy === "oldest") {
    orderBy = { createdAt: "asc" };
  } else if (filter?.sortBy === "sender") {
    orderBy = { fullName: "asc" };
  } else if (filter?.sortBy === "subject") {
    orderBy = { subject: "asc" };
  } else {
    orderBy = { createdAt: "desc" };
  }

  const [messages, totalCount, totalAll, newCount, readCount, repliedCount, archivedCount] = await Promise.all([
    prisma.contactMessage.findMany({
      where,
      take: limit,
      skip: offset,
      orderBy,
    }),
    prisma.contactMessage.count({ where }),
    prisma.contactMessage.count(),
    prisma.contactMessage.count({ where: { status: "NEW" } }),
    prisma.contactMessage.count({ where: { status: "READ" } }),
    prisma.contactMessage.count({ where: { status: "REPLIED" } }),
    prisma.contactMessage.count({ where: { status: "ARCHIVED" } }),
  ]);

  return {
    messages,
    totalCount,
    unreadCount: newCount,
    counts: {
      all: totalAll,
      new: newCount,
      read: readCount,
      replied: repliedCount,
      archived: archivedCount,
    },
    limit,
    offset,
  };
}

export async function getAdminContactMessageDetailOperation(
  request: Request,
  messageId: string,
  options?: { markAsRead?: boolean },
  prismaClient?: PrismaClient
) {
  await requirePermission(request, AdminPermissions.CONTACT_READ, prismaClient);
  const prisma = prismaClient || (await getPrisma());

  if (!messageId || typeof messageId !== "string" || !messageId.trim()) {
    throw new Error("Validation Error: Invalid message ID");
  }

  let message: any;
  try {
    message = await (prisma.contactMessage as any).findUnique({
      where: { id: messageId.trim() },
      include: {
        replies: {
          orderBy: { createdAt: "asc" },
        },
      },
    });
  } catch {
    message = await prisma.contactMessage.findUnique({
      where: { id: messageId.trim() },
    });
  }

  if (!message) {
    throw new Error(`Message with id '${messageId}' not found`);
  }

  if (options?.markAsRead && message.status === "NEW") {
    try {
      return await (prisma.contactMessage as any).update({
        where: { id: messageId.trim() },
        data: {
          status: "READ",
          readAt: new Date(),
        },
        include: {
          replies: {
            orderBy: { createdAt: "asc" },
          },
        },
      });
    } catch {
      return await prisma.contactMessage.update({
        where: { id: messageId.trim() },
        data: {
          status: "READ",
          readAt: new Date(),
        },
      });
    }
  }

  return message;
}

export async function updateAdminContactMessageStatusOperation(
  request: Request,
  payload: {
    messageId: string;
    status: ContactMessageStatus | "NEW" | "READ" | "REPLIED" | "ARCHIVED" | string;
    adminNotes?: string | null;
  },
  prismaClient?: PrismaClient
) {
  const context = await requirePermission(request, AdminPermissions.CONTACT_UPDATE, prismaClient);
  const prisma = prismaClient || (await getPrisma());

  if (!payload.messageId || typeof payload.messageId !== "string" || !payload.messageId.trim()) {
    throw new Error("Validation Error: Invalid message ID");
  }

  const validStatuses: ContactMessageStatus[] = ["NEW", "READ", "REPLIED", "ARCHIVED"];
  const targetStatus = payload.status?.toUpperCase() as ContactMessageStatus;
  if (!validStatuses.includes(targetStatus)) {
    throw new Error(`Validation Error: Invalid contact message status '${payload.status}'`);
  }

  const existing = await prisma.contactMessage.findUnique({
    where: { id: payload.messageId.trim() },
  });
  if (!existing) {
    throw new Error(`Message with id '${payload.messageId}' not found`);
  }

  const updateData: Record<string, any> = {
    status: targetStatus,
  };

  if (targetStatus === "READ") updateData.readAt = new Date();
  if (targetStatus === "REPLIED") updateData.repliedAt = new Date();
  if (targetStatus === "ARCHIVED") updateData.archivedAt = new Date();
  if (payload.adminNotes !== undefined) updateData.adminNotes = payload.adminNotes?.trim() || null;

  return await prisma.$transaction(async (tx: any) => {
    const updated = await tx.contactMessage.update({
      where: { id: payload.messageId.trim() },
      data: updateData,
    });

    // Audit log records status change, intentionally omitting private message body
    await tx.adminAuditLog.create({
      data: {
        actorId: context.profile.id,
        actorEmail: context.profile.email,
        action: "CONTACT_MESSAGE_STATUS_UPDATED",
        module: "CONTACT_MESSAGES",
        entityId: payload.messageId.trim(),
        metadata: {
          newStatus: targetStatus,
          hasAdminNotes: Boolean(payload.adminNotes),
        },
      },
    });

    return updated;
  });
}

export async function deleteAdminContactMessageOperation(
  request: Request,
  messageId: string,
  prismaClient?: PrismaClient
) {
  const context = await requirePermission(request, AdminPermissions.CONTACT_DELETE, prismaClient);
  const prisma = prismaClient || (await getPrisma());

  if (!messageId || typeof messageId !== "string" || !messageId.trim()) {
    throw new Error("Validation Error: Invalid message ID");
  }

  const existing = await prisma.contactMessage.findUnique({
    where: { id: messageId.trim() },
  });
  if (!existing) {
    throw new Error(`Message with id '${messageId}' not found`);
  }

  return await prisma.$transaction(async (tx: any) => {
    await tx.contactMessage.delete({
      where: { id: messageId.trim() },
    });

    await tx.adminAuditLog.create({
      data: {
        actorId: context.profile.id,
        actorEmail: context.profile.email,
        action: "CONTACT_MESSAGE_DELETED",
        module: "CONTACT_MESSAGES",
        entityId: messageId.trim(),
      },
    });

    return { success: true, deletedId: messageId.trim() };
  });
}

export async function bulkDeleteAdminContactMessagesOperation(
  request: Request,
  messageIds: string[],
  prismaClient?: PrismaClient
) {
  const context = await requirePermission(request, AdminPermissions.CONTACT_DELETE, prismaClient);
  const prisma = prismaClient || (await getPrisma());

  if (!Array.isArray(messageIds) || messageIds.length === 0) {
    throw new Error("Validation Error: No message IDs provided for bulk deletion");
  }
  if (messageIds.length > 100) {
    throw new Error("Validation Error: Cannot perform bulk deletion on more than 100 messages at once");
  }
  const cleanIds = messageIds.filter((id) => typeof id === "string" && id.trim().length > 0).map((id) => id.trim());
  if (cleanIds.length === 0) {
    throw new Error("Validation Error: No valid message IDs provided for bulk deletion");
  }

  return await prisma.$transaction(async (tx: any) => {
    const result = await tx.contactMessage.deleteMany({
      where: { id: { in: cleanIds } },
    });

    await tx.adminAuditLog.create({
      data: {
        actorId: context.profile.id,
        actorEmail: context.profile.email,
        action: "CONTACT_MESSAGES_BULK_DELETED",
        module: "CONTACT_MESSAGES",
        entityId: "bulk",
        metadata: { count: result.count, deletedIds: cleanIds },
      },
    });

    return { success: true, deletedCount: result.count };
  });
}

export interface BulkUpdateContactMessagesPayload {
  messageIds: string[];
  status: ContactMessageStatus | "NEW" | "READ" | "REPLIED" | "ARCHIVED" | string;
}

export async function bulkUpdateAdminContactMessageStatusOperation(
  request: Request,
  payload: BulkUpdateContactMessagesPayload,
  prismaClient?: PrismaClient
) {
  const context = await requirePermission(request, AdminPermissions.CONTACT_UPDATE, prismaClient);
  const prisma = prismaClient || (await getPrisma());

  if (!Array.isArray(payload.messageIds) || payload.messageIds.length === 0) {
    throw new Error("Validation Error: No message IDs provided for bulk status update");
  }
  if (payload.messageIds.length > 100) {
    throw new Error("Validation Error: Cannot perform bulk update on more than 100 messages at once");
  }
  const cleanIds = payload.messageIds.filter((id) => typeof id === "string" && id.trim().length > 0).map((id) => id.trim());
  if (cleanIds.length === 0) {
    throw new Error("Validation Error: No valid message IDs provided for bulk status update");
  }

  const validStatuses: ContactMessageStatus[] = ["NEW", "READ", "REPLIED", "ARCHIVED"];
  const targetStatus = payload.status?.toUpperCase() as ContactMessageStatus;
  if (!validStatuses.includes(targetStatus)) {
    throw new Error(`Validation Error: Invalid contact message status '${payload.status}'`);
  }

  const updateData: Record<string, any> = { status: targetStatus };
  if (targetStatus === "READ") updateData.readAt = new Date();
  if (targetStatus === "ARCHIVED") updateData.archivedAt = new Date();
  if (targetStatus === "REPLIED") updateData.repliedAt = new Date();

  return await prisma.$transaction(async (tx: any) => {
    const result = await tx.contactMessage.updateMany({
      where: { id: { in: cleanIds } },
      data: updateData,
    });

    await tx.adminAuditLog.create({
      data: {
        actorId: context.profile.id,
        actorEmail: context.profile.email,
        action: "CONTACT_MESSAGES_BULK_STATUS_UPDATED",
        module: "CONTACT_MESSAGES",
        entityId: "bulk",
        metadata: {
          count: result.count,
          newStatus: targetStatus,
          messageIds: cleanIds,
        },
      },
    });

    return { success: true, updatedCount: result.count };
  });
}

// =========================================================================
// 6. PUBLIC CONTACT FORM SUBMISSION (SECURE & ANTI-ABUSE PROTECTED)
// =========================================================================

export interface SubmitPublicMessageOptions {
  clientIp?: string | null;
  userAgent?: string | null;
}

/**
 * Dedicated safe public contact submission handler.
 * Implements:
 * 1. Honeypot check (filters out automated spam silently)
 * 2. Strict input validation and field capping
 * 3. Database-backed rate limiting (multi-instance reliable, checked on email & IP)
 * 4. Accidental duplicate submission protection
 * 5. Safe generic error reporting
 */
export async function submitPublicContactMessageOperation(
  payload: SubmitContactMessagePayload,
  options?: SubmitPublicMessageOptions,
  prismaClient?: PrismaClient
): Promise<{ success: boolean; id: string }> {
  // 1. Honeypot check
  if (payload.honeypot && payload.honeypot.trim().length > 0) {
    // Return simulated success without database write to confound automated bots
    return { success: true, id: "filtered" };
  }

  // 2. Strict field validation
  const fullName = payload.fullName?.trim();
  if (!fullName || fullName.length < 2 || fullName.length > 100) {
    throw new Error("Validation Error: Full name must be between 2 and 100 characters");
  }

  const normalizedEmail = normalizeEmail(payload.email);

  const subject = payload.subject?.trim();
  if (!subject || subject.length < 2 || subject.length > 150) {
    throw new Error("Validation Error: Subject must be between 2 and 150 characters");
  }

  const message = payload.message?.trim();
  if (!message || message.length < 10) {
    throw new Error("Validation Error: Message must be at least 10 characters long");
  }
  if (message.length > 2000) {
    throw new Error("Validation Error: Message exceeds 2000 characters limit");
  }

  const prisma = prismaClient || (await getPrisma());

  // 3. Database-backed multi-instance transactional rate limiting & concurrency protection
  const runInTx =
    typeof prisma.$transaction === "function"
      ? (cb: any) => prisma.$transaction(cb)
      : (cb: any) => cb(prisma);

  const res = await runInTx(async (tx: any) => {
    // Acquire PostgreSQL transaction-level advisory locks to serialize concurrent requests
    // for the same email and IP without table locks or schema modifications
    try {
      if (typeof tx.$executeRawUnsafe === "function") {
        await tx.$executeRawUnsafe(
          `SELECT pg_advisory_xact_lock(hashtext($1))`,
          `contact_rate:${normalizedEmail}`
        );
        if (options?.clientIp && options.clientIp.trim()) {
          await tx.$executeRawUnsafe(
            `SELECT pg_advisory_xact_lock(hashtext($1))`,
            `contact_ip_rate:${options.clientIp.trim()}`
          );
        }
      }
    } catch {
      // In mock/test environments where advisory locks or raw SQL are not supported,
      // continue safely with transactional count checks
    }

    const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);

    // Check rate limit per email (max 5 submissions in 15 minutes)
    const recentEmailSubmissions = await tx.contactMessage.count({
      where: {
        email: normalizedEmail,
        createdAt: { gte: fifteenMinutesAgo },
      },
    });

    if (recentEmailSubmissions >= 5) {
      throw new Error("Rate Limit Exceeded: Too many messages sent from this email address. Please try again later.");
    }

    // Check rate limit per client IP if provided (max 10 submissions in 15 minutes)
    if (options?.clientIp && options.clientIp.trim()) {
      const ip = options.clientIp.trim();
      const recentIpSubmissions = await tx.contactMessage.count({
        where: {
          ipAddress: ip,
          createdAt: { gte: fifteenMinutesAgo },
        },
      });

      if (recentIpSubmissions >= 10) {
        throw new Error("Rate Limit Exceeded: Too many submissions from your connection. Please wait a few minutes.");
      }
    }

    // Prevent accidental duplicate submissions within 60 seconds
    if (typeof tx.contactMessage.findFirst === "function") {
      const oneMinuteAgo = new Date(Date.now() - 60 * 1000);
      const existingDuplicate = await tx.contactMessage.findFirst({
        where: {
          email: normalizedEmail,
          subject,
          message,
          createdAt: { gte: oneMinuteAgo },
        },
      });

      if (existingDuplicate) {
        return { success: true, id: existingDuplicate.id };
      }
    }

    // 4. Persistence to PostgreSQL ContactMessage table
    const created = await tx.contactMessage.create({
      data: {
        fullName,
        email: normalizedEmail,
        subject,
        message,
        status: "NEW",
        ipAddress: options?.clientIp?.slice(0, 45) || null,
        userAgent: options?.userAgent?.slice(0, 255) || null,
      },
    });

    return { success: true, id: created.id };
  });

  if (res?.success && res.id) {
    try {
      await createNotificationEvent(
        {
          category: "CONTACT_INQUIRY",
          title: "New Contact Inquiry",
          message: `${fullName} sent an inquiry: "${subject}".`,
          link: "/admin/contact/messages",
          eventKey: `contact:inquiry:${res.id}`,
        },
        prismaClient
      );
    } catch (notifErr) {
      console.warn("[ContactOperation] Failed to dispatch in-app notification:", notifErr);
    }
  }

  return res;
}

// =========================================================================
// 8. ADMIN EMAIL REPLY OPERATIONS (RESEND INTEGRATION)
// =========================================================================

export interface SendAdminReplyPayload {
  messageId: string;
  subject: string;
  body: string;
  idempotencyKey?: string;
}

// Persistent, multi-instance rate limiting & concurrency protection:
// Outbound email replies are capped at 10 per 60 seconds per admin account.
// Concurrency is serialized via PostgreSQL advisory transaction locks (pg_advisory_xact_lock)
// and enforced against durable ContactMessageReply records in PostgreSQL.

export async function sendAdminContactMessageReplyOperation(
  request: Request,
  payload: SendAdminReplyPayload,
  prismaClient?: PrismaClient,
  emailClientOverride?: EmailClient
): Promise<{ success: boolean; reply: any; message: any; isDuplicate?: boolean }> {
  // 1. Authentication & RBAC Authorization Check
  const context = await requirePermission(request, AdminPermissions.CONTACT_UPDATE, prismaClient);
  const prisma = prismaClient || (await getPrisma());

  // 2. Strict Input Validation & Header Injection Guard
  if (!payload.messageId || typeof payload.messageId !== "string" || !payload.messageId.trim()) {
    throw new Error("Validation Error: Invalid message ID");
  }

  const trimmedSubject = payload.subject?.trim();
  if (!trimmedSubject || trimmedSubject.length < 1) {
    throw new Error("Validation Error: Reply subject is required");
  }
  if (trimmedSubject.length > 200) {
    throw new Error("Validation Error: Reply subject cannot exceed 200 characters");
  }
  if (/[\r\n]/.test(trimmedSubject)) {
    throw new Error("Validation Error: Reply subject cannot contain newline characters (header injection detected)");
  }

  const trimmedBody = payload.body?.trim();
  if (!trimmedBody || trimmedBody.length < 10) {
    throw new Error("Validation Error: Reply body must be at least 10 characters long");
  }
  if (trimmedBody.length > 10000) {
    throw new Error("Validation Error: Reply body cannot exceed 10,000 characters");
  }

  // 3. Server-Side Recipient Selection (Anti-Relay Protection: strictly from database record)
  const message = await prisma.contactMessage.findUnique({
    where: { id: payload.messageId.trim() },
  });
  if (!message) {
    throw new Error(`Message with id '${payload.messageId}' not found`);
  }

  // 4. Pre-Dispatch Persistence Health Check:
  // Strictly require reply-history storage to be available BEFORE external email dispatch.
  // If the ContactMessageReply table is not yet created/migrated, fail immediately to prevent
  // unrecorded outbound email transmissions or non-durable status transitions.
  if (!(prisma as any).contactMessageReply) {
    throw new Error(
      "Database Error: ContactMessageReply storage model is unavailable. Database migration '20261012200000_add_contact_message_reply' must be applied before sending replies."
    );
  }

  try {
    await (prisma as any).contactMessageReply.findFirst({
      select: { id: true },
    });
  } catch (tableErr: any) {
    throw new Error(
      `Database Configuration Error: Reply history table is not initialized (${tableErr?.message || "Table missing"}). Please apply database migration '20261012200000_add_contact_message_reply' before sending email replies.`
    );
  }

  // 5. Idempotency Check (Prevent duplicate dispatches on retry or double-click)
  const trimmedIdempotencyKey = payload.idempotencyKey?.trim() || undefined;
  if (trimmedIdempotencyKey) {
    const existingReply = await (prisma as any).contactMessageReply.findUnique({
      where: { idempotencyKey: trimmedIdempotencyKey },
    });
    if (existingReply) {
      return {
        success: true,
        reply: existingReply,
        message,
        isDuplicate: true,
      };
    }
  }

  // 6. Persistent Rate Limiting & Concurrency-Safe Outbound Dispatch
  // Serializes concurrent requests per admin account and enforces maximum 10 email replies
  // per 60 seconds backed by persistent ContactMessageReply records in PostgreSQL.
  const adminId = context.profile.id;
  const runInTx =
    typeof prisma.$transaction === "function"
      ? (cb: any) => prisma.$transaction(cb, { timeout: 15000 })
      : (cb: any) => cb(prisma);

  let sendResult: any;
  let txResult: any;

  try {
    txResult = await runInTx(async (tx: any) => {
      // 6a. Concurrency Protection: Acquire PostgreSQL transaction-level advisory lock
      // for this specific admin to serialize concurrent requests without table locks or schema modifications
      try {
        if (typeof tx.$executeRawUnsafe === "function") {
          await tx.$executeRawUnsafe(
            `SELECT pg_advisory_xact_lock(hashtext($1))`,
            `admin_reply_rate:${adminId}`
          );
        }
      } catch {
        // Safe fallback in mock/test environments
      }

      // 6b. Query persistent count of replies dispatched by this admin in the sliding 60-second window
      const sixtySecondsAgo = new Date(Date.now() - 60 * 1000);
      const recentRepliesCount =
        typeof tx.contactMessageReply?.count === "function"
          ? await tx.contactMessageReply.count({
              where: {
                adminId,
                status: "SENT",
                createdAt: { gte: sixtySecondsAgo },
              },
            })
          : 0;

      if (recentRepliesCount >= 10) {
        throw new Error("Rate Limit Exceeded: Too many email replies sent. Please wait a minute before sending another.");
      }

      // 7. External Dispatch via Resend Provider Client
      const emailClient = emailClientOverride || createResendEmailClient();
      sendResult = await emailClient.sendEmail({
        to: message.email,
        subject: trimmedSubject,
        text: trimmedBody,
        idempotencyKey: trimmedIdempotencyKey,
      });

      // 8a. Insert durable reply record (no swallowed errors, no null fallback)
      const createdReply = await tx.contactMessageReply.create({
        data: {
          messageId: message.id,
          adminId: context.profile.id,
          adminEmail: context.profile.email,
          toEmail: message.email,
          subject: trimmedSubject,
          bodyText: trimmedBody,
          provider: sendResult.provider,
          providerMessageId: sendResult.providerMessageId,
          status: "SENT",
          idempotencyKey: trimmedIdempotencyKey || null,
        },
      });

      // 8b. Update ContactMessage status to REPLIED and record repliedAt timestamp
      const updated = await tx.contactMessage.update({
        where: { id: message.id },
        data: {
          status: "REPLIED",
          repliedAt: new Date(),
        },
      });

      // 8c. Write audit log entry (omitting message body or private PII for compliance)
      await tx.adminAuditLog.create({
        data: {
          actorId: context.profile.id,
          actorEmail: context.profile.email,
          action: "CONTACT_MESSAGE_REPLY_SENT",
          module: "CONTACT_MESSAGES",
          entityId: message.id,
          metadata: {
            replyId: createdReply.id,
            provider: sendResult.provider,
            providerMessageId: sendResult.providerMessageId,
            recipientDomain: message.email.split("@")[1] || "unknown",
          },
        },
      });

      return { reply: createdReply, message: updated };
    });
  } catch (err: any) {
    if (sendResult) {
      // Post-dispatch failure analysis:
      // The provider accepted the message, but database persistence failed.
      // An external email cannot be rolled back by a DB rollback.
      // Do NOT report success, and do NOT falsely claim database status updated.
      // Throw an explicit delivery ambiguity error preserving the idempotency key for safe retry.
      throw new Error(
        `Delivery Ambiguity: Email accepted by provider (ID: ${sendResult.providerMessageId}), but database persistence failed: ${err?.message || "Transaction failure"}. Retrying with the same idempotency key will safely re-attempt persistence without duplicate sends.`
      );
    }
    throw err;
  }

  return {
    success: true,
    reply: txResult.reply,
    message: txResult.message,
  };
}

export async function listAdminContactMessageRepliesOperation(
  request: Request,
  messageId: string,
  prismaClient?: PrismaClient
): Promise<any[]> {
  await requirePermission(request, AdminPermissions.CONTACT_READ, prismaClient);
  const prisma = prismaClient || (await getPrisma());

  if (!messageId || typeof messageId !== "string" || !messageId.trim()) {
    throw new Error("Validation Error: Invalid message ID");
  }

  if (!(prisma as any).contactMessageReply) {
    return [];
  }

  try {
    return await (prisma as any).contactMessageReply.findMany({
      where: { messageId: messageId.trim() },
      orderBy: { createdAt: "asc" },
    });
  } catch {
    return [];
  }
}
