-- CreateTable: ContactMessageReply for durable audit & thread tracking
CREATE TABLE IF NOT EXISTS "ContactMessageReply" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "adminId" TEXT,
    "adminEmail" TEXT NOT NULL,
    "toEmail" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "bodyText" TEXT NOT NULL,
    "bodyHtml" TEXT,
    "provider" TEXT NOT NULL DEFAULT 'resend',
    "providerMessageId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'SENT',
    "errorMessage" TEXT,
    "idempotencyKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContactMessageReply_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "ContactMessageReply_idempotencyKey_key" ON "ContactMessageReply"("idempotencyKey");
CREATE INDEX IF NOT EXISTS "ContactMessageReply_messageId_createdAt_idx" ON "ContactMessageReply"("messageId", "createdAt" ASC);
CREATE INDEX IF NOT EXISTS "ContactMessageReply_adminId_idx" ON "ContactMessageReply"("adminId");

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'ContactMessageReply_messageId_fkey'
    ) THEN
        ALTER TABLE "ContactMessageReply" ADD CONSTRAINT "ContactMessageReply_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "ContactMessage"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'ContactMessageReply_adminId_fkey'
    ) THEN
        ALTER TABLE "ContactMessageReply" ADD CONSTRAINT "ContactMessageReply_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "AdminProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;
