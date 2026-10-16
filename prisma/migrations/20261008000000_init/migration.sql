-- CobraLearn InnoTechCore Showcase + Admin CMS
-- Initial Database Migration (Database Architecture v1 Frozen)
-- Authoritative Initial PostgreSQL DDL Migration (Cleaned Indexes)

-- CreateEnum
CREATE TYPE "PublishStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "MediaType" AS ENUM ('IMAGE', 'VIDEO', 'DOCUMENT', 'OTHER');

-- CreateEnum
CREATE TYPE "MediaCategory" AS ENUM ('ADVERTISEMENTS', 'WEBSITES', 'AWARDS', 'PROJECTS', 'GENERAL');

-- CreateEnum
CREATE TYPE "NavItemType" AS ENUM ('INTERNAL', 'EXTERNAL', 'BUTTON');

-- CreateEnum
CREATE TYPE "NavItemStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "HighlightAccent" AS ENUM ('EMERALD', 'CYAN', 'AMBER');

-- CreateEnum
CREATE TYPE "ContactMessageStatus" AS ENUM ('NEW', 'READ', 'REPLIED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "AdminRole" AS ENUM ('SUPER_ADMIN', 'ADMIN', 'EDITOR');

-- CreateTable
CREATE TABLE "AdminProfile" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "designation" TEXT,
    "avatarUrl" TEXT,
    "role" "AdminRole" NOT NULL DEFAULT 'EDITOR',
    "phone" TEXT,
    "bio" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdminProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminAuditLog" (
    "id" TEXT NOT NULL,
    "actorId" TEXT,
    "actorEmail" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "module" TEXT NOT NULL,
    "entityId" TEXT,
    "metadata" JSONB,
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MediaAsset" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "originalFilename" TEXT NOT NULL,
    "bucket" TEXT NOT NULL DEFAULT 'media-library',
    "storagePath" TEXT NOT NULL,
    "publicUrl" TEXT NOT NULL,
    "mediaType" "MediaType" NOT NULL,
    "category" "MediaCategory" NOT NULL,
    "mimeType" TEXT NOT NULL,
    "fileSize" BIGINT NOT NULL,
    "fileExtension" TEXT NOT NULL,
    "dimensions" TEXT,
    "duration" TEXT,
    "altText" TEXT,
    "description" TEXT,
    "tags" TEXT[],
    "uploadedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MediaAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "fullDescription" TEXT,
    "category" TEXT NOT NULL,
    "status" "PublishStatus" NOT NULL DEFAULT 'DRAFT',
    "featured" BOOLEAN NOT NULL DEFAULT false,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "projectDuration" TEXT,
    "teamSize" TEXT,
    "technologies" TEXT[],
    "tags" TEXT[],
    "liveUrl" TEXT,
    "githubUrl" TEXT,
    "videoUrl" TEXT,
    "thumbnailId" TEXT,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectGalleryItem" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "mediaId" TEXT NOT NULL,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ProjectGalleryItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Website" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "fullDescription" TEXT,
    "category" TEXT NOT NULL,
    "status" "PublishStatus" NOT NULL DEFAULT 'DRAFT',
    "featured" BOOLEAN NOT NULL DEFAULT false,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "launchDate" TEXT,
    "teamSize" TEXT,
    "technologies" TEXT[],
    "tags" TEXT[],
    "githubUrl" TEXT,
    "videoUrl" TEXT,
    "thumbnailId" TEXT,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Website_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebsiteGalleryItem" (
    "id" TEXT NOT NULL,
    "websiteId" TEXT NOT NULL,
    "mediaId" TEXT NOT NULL,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "WebsiteGalleryItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Advertisement" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "campaign" TEXT NOT NULL,
    "brand" TEXT NOT NULL,
    "campaignType" TEXT,
    "description" TEXT NOT NULL,
    "fullDescription" TEXT,
    "startDate" TEXT,
    "endDate" TEXT,
    "date" TEXT NOT NULL,
    "campaignUrl" TEXT,
    "status" "PublishStatus" NOT NULL DEFAULT 'DRAFT',
    "featured" BOOLEAN NOT NULL DEFAULT false,
    "showOnHomepage" BOOLEAN NOT NULL DEFAULT false,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "thumbnailId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Advertisement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Award" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "context" TEXT NOT NULL,
    "organization" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "fullDescription" TEXT,
    "credentialUrl" TEXT,
    "status" "PublishStatus" NOT NULL DEFAULT 'DRAFT',
    "showOnHomepage" BOOLEAN NOT NULL DEFAULT true,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "thumbnailId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Award_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HomepageSection" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "iconName" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "displayOrder" INTEGER NOT NULL,
    "badge" TEXT,
    "title" TEXT NOT NULL,
    "subtitle" TEXT NOT NULL,
    "primaryButtonLabel" TEXT,
    "primaryButtonLink" TEXT,
    "secondaryButtonLabel" TEXT,
    "secondaryButtonLink" TEXT,
    "mediaAssetId" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HomepageSection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NavigationItem" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "link" TEXT NOT NULL,
    "type" "NavItemType" NOT NULL DEFAULT 'INTERNAL',
    "status" "NavItemStatus" NOT NULL DEFAULT 'ACTIVE',
    "iconName" TEXT,
    "openInNewTab" BOOLEAN NOT NULL DEFAULT false,
    "buttonStyle" TEXT,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NavigationItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FooterSection" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "iconName" TEXT,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "isVisible" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FooterSection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FooterLink" (
    "id" TEXT NOT NULL,
    "footerSectionId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "openInNewTab" BOOLEAN NOT NULL DEFAULT false,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "FooterLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GlobalSocialLink" (
    "id" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "handle" TEXT,
    "iconName" TEXT NOT NULL,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GlobalSocialLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AppearanceConfig" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "themePreset" TEXT NOT NULL DEFAULT 'dark',
    "brandPrimaryColor" TEXT NOT NULL DEFAULT '#00FF87',
    "brandSecondaryColor" TEXT NOT NULL DEFAULT '#00E5FF',
    "brandAccentColor" TEXT NOT NULL DEFAULT '#FFB800',
    "fontHeading" TEXT NOT NULL DEFAULT 'Space Grotesk',
    "fontBody" TEXT NOT NULL DEFAULT 'Inter',
    "logoAssetId" TEXT,
    "faviconAssetId" TEXT,
    "enableGlowEffects" BOOLEAN NOT NULL DEFAULT true,
    "enableAnimations" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppearanceConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SiteSettings" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "siteName" TEXT NOT NULL DEFAULT 'CobraLearn Innotechcore',
    "tagline" TEXT NOT NULL DEFAULT 'Digital Showcase & Technology Hub',
    "siteDescription" TEXT NOT NULL DEFAULT 'A cinematic showcase of digital innovation, web experiences, real-time projects and achievements.',
    "siteUrl" TEXT NOT NULL DEFAULT 'https://cobralearn.com',
    "contactEmail" TEXT NOT NULL DEFAULT 'contact@cobralearn.com',
    "contactPhone" TEXT NOT NULL DEFAULT '+91 98765 43210',
    "contactAddress" TEXT NOT NULL DEFAULT 'Hyderabad, Telangana, India',
    "businessHours" TEXT NOT NULL DEFAULT 'Mon - Fri: 9:00 AM - 6:00 PM IST',
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Kolkata',
    "dateFormat" TEXT NOT NULL DEFAULT 'DD/MM/YYYY',
    "timeFormat" TEXT NOT NULL DEFAULT '12-hour',
    "defaultLanguage" TEXT NOT NULL DEFAULT 'en',
    "metaKeywords" TEXT[] DEFAULT ARRAY['technology', 'showcase', 'web development', 'digital innovation']::TEXT[],
    "ogImageUrl" TEXT,
    "notifyOnNewMessage" BOOLEAN NOT NULL DEFAULT true,
    "notificationEmail" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SiteSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContactPageConfig" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "badgeText" TEXT NOT NULL DEFAULT 'CONNECT WITH US',
    "heroTitle" TEXT NOT NULL DEFAULT 'Let’s Build the Next Generation of Digital Experiences',
    "heroSubtitle" TEXT NOT NULL DEFAULT 'Have a project in mind, an inquiry about our solutions, or interested in a collaboration? Reach out and our team will get back to you promptly.',
    "formTitle" TEXT NOT NULL DEFAULT 'Send Us a Message',
    "formSubtitle" TEXT NOT NULL DEFAULT 'Fill out the form below and we will respond within 24 hours.',
    "formSuccessMessage" TEXT NOT NULL DEFAULT 'Thank you! Your message has been transmitted successfully. Our team will review and connect with you shortly.',
    "subjectOptions" TEXT[] DEFAULT ARRAY['General Inquiry', 'Project Consultation', 'Partnership & Collaboration', 'Career & Opportunities', 'Technical Support']::TEXT[],
    "enableFaqSection" BOOLEAN NOT NULL DEFAULT true,
    "enableHighlights" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContactPageConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContactHighlight" (
    "id" TEXT NOT NULL,
    "contactConfigId" TEXT NOT NULL DEFAULT 'default',
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "iconName" TEXT NOT NULL,
    "accentColor" "HighlightAccent" NOT NULL DEFAULT 'EMERALD',
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "ContactHighlight_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContactFaq" (
    "id" TEXT NOT NULL,
    "contactConfigId" TEXT NOT NULL DEFAULT 'default',
    "question" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "ContactFaq_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContactMessage" (
    "id" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "status" "ContactMessageStatus" NOT NULL DEFAULT 'NEW',
    "adminNotes" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "readAt" TIMESTAMP(3),
    "repliedAt" TIMESTAMP(3),
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContactMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AdminProfile_email_key" ON "AdminProfile"("email");

-- CreateIndex
CREATE INDEX "AdminAuditLog_actorId_createdAt_idx" ON "AdminAuditLog"("actorId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "AdminAuditLog_module_action_idx" ON "AdminAuditLog"("module", "action");

-- CreateIndex
CREATE INDEX "MediaAsset_mediaType_idx" ON "MediaAsset"("mediaType");

-- CreateIndex
CREATE INDEX "MediaAsset_category_idx" ON "MediaAsset"("category");

-- CreateIndex
CREATE INDEX "MediaAsset_createdAt_idx" ON "MediaAsset"("createdAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "MediaAsset_bucket_storagePath_key" ON "MediaAsset"("bucket", "storagePath");

-- CreateIndex
CREATE UNIQUE INDEX "Project_slug_key" ON "Project"("slug");

-- CreateIndex
CREATE INDEX "Project_status_displayOrder_idx" ON "Project"("status", "displayOrder");

-- CreateIndex
CREATE INDEX "Project_featured_idx" ON "Project"("featured");

-- CreateIndex
CREATE INDEX "ProjectGalleryItem_projectId_displayOrder_idx" ON "ProjectGalleryItem"("projectId", "displayOrder");

-- CreateIndex
CREATE UNIQUE INDEX "Website_slug_key" ON "Website"("slug");

-- CreateIndex
CREATE INDEX "Website_status_displayOrder_idx" ON "Website"("status", "displayOrder");

-- CreateIndex
CREATE INDEX "Website_featured_idx" ON "Website"("featured");

-- CreateIndex
CREATE INDEX "WebsiteGalleryItem_websiteId_displayOrder_idx" ON "WebsiteGalleryItem"("websiteId", "displayOrder");

-- CreateIndex
CREATE UNIQUE INDEX "Advertisement_slug_key" ON "Advertisement"("slug");

-- CreateIndex
CREATE INDEX "Advertisement_status_displayOrder_idx" ON "Advertisement"("status", "displayOrder");

-- CreateIndex
CREATE INDEX "Advertisement_showOnHomepage_idx" ON "Advertisement"("showOnHomepage");

-- CreateIndex
CREATE UNIQUE INDEX "Award_slug_key" ON "Award"("slug");

-- CreateIndex
CREATE INDEX "Award_status_displayOrder_idx" ON "Award"("status", "displayOrder");

-- CreateIndex
CREATE INDEX "Award_showOnHomepage_idx" ON "Award"("showOnHomepage");

-- CreateIndex
CREATE INDEX "HomepageSection_enabled_displayOrder_idx" ON "HomepageSection"("enabled", "displayOrder");

-- CreateIndex
CREATE INDEX "NavigationItem_status_displayOrder_idx" ON "NavigationItem"("status", "displayOrder");

-- CreateIndex
CREATE INDEX "FooterSection_isVisible_displayOrder_idx" ON "FooterSection"("isVisible", "displayOrder");

-- CreateIndex
CREATE INDEX "FooterLink_footerSectionId_displayOrder_idx" ON "FooterLink"("footerSectionId", "displayOrder");

-- CreateIndex
CREATE INDEX "GlobalSocialLink_isEnabled_displayOrder_idx" ON "GlobalSocialLink"("isEnabled", "displayOrder");

-- CreateIndex
CREATE INDEX "ContactHighlight_contactConfigId_displayOrder_idx" ON "ContactHighlight"("contactConfigId", "displayOrder");

-- CreateIndex
CREATE INDEX "ContactFaq_contactConfigId_displayOrder_idx" ON "ContactFaq"("contactConfigId", "displayOrder");

-- CreateIndex
CREATE INDEX "ContactMessage_status_createdAt_idx" ON "ContactMessage"("status", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "ContactMessage_email_idx" ON "ContactMessage"("email");

-- AddForeignKey
ALTER TABLE "AdminAuditLog" ADD CONSTRAINT "AdminAuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "AdminProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MediaAsset" ADD CONSTRAINT "MediaAsset_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "AdminProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_thumbnailId_fkey" FOREIGN KEY ("thumbnailId") REFERENCES "MediaAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectGalleryItem" ADD CONSTRAINT "ProjectGalleryItem_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectGalleryItem" ADD CONSTRAINT "ProjectGalleryItem_mediaId_fkey" FOREIGN KEY ("mediaId") REFERENCES "MediaAsset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Website" ADD CONSTRAINT "Website_thumbnailId_fkey" FOREIGN KEY ("thumbnailId") REFERENCES "MediaAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WebsiteGalleryItem" ADD CONSTRAINT "WebsiteGalleryItem_websiteId_fkey" FOREIGN KEY ("websiteId") REFERENCES "Website"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WebsiteGalleryItem" ADD CONSTRAINT "WebsiteGalleryItem_mediaId_fkey" FOREIGN KEY ("mediaId") REFERENCES "MediaAsset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Advertisement" ADD CONSTRAINT "Advertisement_thumbnailId_fkey" FOREIGN KEY ("thumbnailId") REFERENCES "MediaAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Award" ADD CONSTRAINT "Award_thumbnailId_fkey" FOREIGN KEY ("thumbnailId") REFERENCES "MediaAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HomepageSection" ADD CONSTRAINT "HomepageSection_mediaAssetId_fkey" FOREIGN KEY ("mediaAssetId") REFERENCES "MediaAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FooterLink" ADD CONSTRAINT "FooterLink_footerSectionId_fkey" FOREIGN KEY ("footerSectionId") REFERENCES "FooterSection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AppearanceConfig" ADD CONSTRAINT "AppearanceConfig_logoAssetId_fkey" FOREIGN KEY ("logoAssetId") REFERENCES "MediaAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AppearanceConfig" ADD CONSTRAINT "AppearanceConfig_faviconAssetId_fkey" FOREIGN KEY ("faviconAssetId") REFERENCES "MediaAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContactHighlight" ADD CONSTRAINT "ContactHighlight_contactConfigId_fkey" FOREIGN KEY ("contactConfigId") REFERENCES "ContactPageConfig"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContactFaq" ADD CONSTRAINT "ContactFaq_contactConfigId_fkey" FOREIGN KEY ("contactConfigId") REFERENCES "ContactPageConfig"("id") ON DELETE CASCADE ON UPDATE CASCADE;
