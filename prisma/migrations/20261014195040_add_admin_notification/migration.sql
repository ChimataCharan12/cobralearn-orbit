-- CreateTable
CREATE TABLE "AdminNotification" (
    "id" TEXT NOT NULL,
    "adminId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "link" TEXT,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "readAt" TIMESTAMP(3),
    "eventKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminNotification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AdminNotification_adminId_isRead_createdAt_idx" ON "AdminNotification"("adminId", "isRead", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "AdminNotification_adminId_createdAt_idx" ON "AdminNotification"("adminId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "AdminNotification_adminId_eventKey_idx" ON "AdminNotification"("adminId", "eventKey");

-- AddForeignKey
ALTER TABLE "AdminNotification" ADD CONSTRAINT "AdminNotification_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "AdminProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
