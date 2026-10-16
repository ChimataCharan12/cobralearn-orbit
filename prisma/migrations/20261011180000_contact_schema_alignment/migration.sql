-- AlterTable: Add missing hero, SEO, presentation, and media fields to ContactPageConfig
ALTER TABLE "ContactPageConfig" ADD COLUMN IF NOT EXISTS "heroSectionNumber" TEXT NOT NULL DEFAULT '01',
ADD COLUMN IF NOT EXISTS "heroSectionLabel" TEXT NOT NULL DEFAULT 'CONTACT',
ADD COLUMN IF NOT EXISTS "heroHighlightHeading" TEXT NOT NULL DEFAULT 'SOMETHING TOGETHER',
ADD COLUMN IF NOT EXISTS "heroDescription" TEXT,
ADD COLUMN IF NOT EXISTS "heroKeywords" TEXT[] DEFAULT ARRAY['IDEAS', 'PARTNERSHIPS', 'GROWTH', 'TOGETHER']::TEXT[],
ADD COLUMN IF NOT EXISTS "heroBackgroundAssetId" TEXT,
ADD COLUMN IF NOT EXISTS "seoPageTitle" TEXT NOT NULL DEFAULT 'Contact Us — CobraLearn Innotechcore',
ADD COLUMN IF NOT EXISTS "seoMetaDescription" TEXT NOT NULL DEFAULT 'Have a project, partnership, or idea in mind? Connect with CobraLearn Innotechcore to build impactful digital experiences.',
ADD COLUMN IF NOT EXISTS "contactEmailDescription" TEXT NOT NULL DEFAULT 'For general inquiries and business discussions',
ADD COLUMN IF NOT EXISTS "contactLocationDescription" TEXT NOT NULL DEFAULT 'Open for onsite meetings (by appointment)',
ADD COLUMN IF NOT EXISTS "formSubmitButtonText" TEXT NOT NULL DEFAULT 'Send Message',
ADD COLUMN IF NOT EXISTS "formErrorMessage" TEXT NOT NULL DEFAULT 'Please check the required fields and try again.';

-- Ensure default ContactPageConfig row exists before child foreign keys are enforced
INSERT INTO "ContactPageConfig" ("id", "updatedAt") VALUES ('default', CURRENT_TIMESTAMP) ON CONFLICT ("id") DO NOTHING;

-- AlterTable: Add iconName to ContactFaq
ALTER TABLE "ContactFaq" ADD COLUMN IF NOT EXISTS "iconName" TEXT;

-- CreateTable: ContactSocialLink for Contact-specific social profile links
CREATE TABLE IF NOT EXISTS "ContactSocialLink" (
    "id" TEXT NOT NULL,
    "contactConfigId" TEXT NOT NULL DEFAULT 'default',
    "platform" TEXT NOT NULL,
    "label" TEXT,
    "url" TEXT NOT NULL,
    "iconName" TEXT NOT NULL,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContactSocialLink_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ContactSocialLink_contactConfigId_displayOrder_idx" ON "ContactSocialLink"("contactConfigId", "displayOrder");

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'ContactPageConfig_heroBackgroundAssetId_fkey'
    ) THEN
        ALTER TABLE "ContactPageConfig" ADD CONSTRAINT "ContactPageConfig_heroBackgroundAssetId_fkey" FOREIGN KEY ("heroBackgroundAssetId") REFERENCES "MediaAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'ContactSocialLink_contactConfigId_fkey'
    ) THEN
        ALTER TABLE "ContactSocialLink" ADD CONSTRAINT "ContactSocialLink_contactConfigId_fkey" FOREIGN KEY ("contactConfigId") REFERENCES "ContactPageConfig"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;
