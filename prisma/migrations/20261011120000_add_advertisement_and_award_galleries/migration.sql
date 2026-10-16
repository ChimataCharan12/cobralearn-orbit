-- CreateTable
CREATE TABLE "AdvertisementGalleryItem" (
    "id" TEXT NOT NULL,
    "advertisementId" TEXT NOT NULL,
    "mediaId" TEXT NOT NULL,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "AdvertisementGalleryItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AwardGalleryItem" (
    "id" TEXT NOT NULL,
    "awardId" TEXT NOT NULL,
    "mediaId" TEXT NOT NULL,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "AwardGalleryItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AdvertisementGalleryItem_advertisementId_displayOrder_idx" ON "AdvertisementGalleryItem"("advertisementId", "displayOrder");

-- CreateIndex
CREATE INDEX "AwardGalleryItem_awardId_displayOrder_idx" ON "AwardGalleryItem"("awardId", "displayOrder");

-- AddForeignKey
ALTER TABLE "AdvertisementGalleryItem" ADD CONSTRAINT "AdvertisementGalleryItem_advertisementId_fkey" FOREIGN KEY ("advertisementId") REFERENCES "Advertisement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvertisementGalleryItem" ADD CONSTRAINT "AdvertisementGalleryItem_mediaId_fkey" FOREIGN KEY ("mediaId") REFERENCES "MediaAsset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AwardGalleryItem" ADD CONSTRAINT "AwardGalleryItem_awardId_fkey" FOREIGN KEY ("awardId") REFERENCES "Award"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AwardGalleryItem" ADD CONSTRAINT "AwardGalleryItem_mediaId_fkey" FOREIGN KEY ("mediaId") REFERENCES "MediaAsset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
