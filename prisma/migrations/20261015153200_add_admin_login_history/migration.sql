-- CreateTable
CREATE TABLE "AdminLoginHistory" (
    "id" TEXT NOT NULL,
    "adminId" TEXT,
    "email" TEXT NOT NULL,
    "sessionId" TEXT,
    "userAgent" TEXT,
    "browser" TEXT,
    "os" TEXT,
    "deviceType" TEXT,
    "loginAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminLoginHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AdminLoginHistory_sessionId_key" ON "AdminLoginHistory"("sessionId");

-- CreateIndex
CREATE INDEX "AdminLoginHistory_adminId_loginAt_idx" ON "AdminLoginHistory"("adminId", "loginAt" DESC);

-- CreateIndex
CREATE INDEX "AdminLoginHistory_loginAt_idx" ON "AdminLoginHistory"("loginAt" DESC);

-- AddForeignKey
ALTER TABLE "AdminLoginHistory" ADD CONSTRAINT "AdminLoginHistory_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "AdminProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
