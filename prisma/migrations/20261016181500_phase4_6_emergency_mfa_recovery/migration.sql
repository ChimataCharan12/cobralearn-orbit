-- CreateEnum
CREATE TYPE "MfaRecoveryActorType" AS ENUM ('SUPER_ADMIN_PEER', 'HOST_CLI_BREAK_GLASS', 'SYSTEM_RECONCILER');

-- CreateEnum
CREATE TYPE "MfaRecoveryStatus" AS ENUM ('PENDING', 'FACTOR_DELETED', 'COMPLETED', 'FAILED', 'RECONCILIATION_REQUIRED');

-- AlterTable
ALTER TABLE "AdminProfile" ADD COLUMN "mfaRecoveryPending" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "mfaRecoveryAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "AdminMfaRecovery" (
    "id" TEXT NOT NULL,
    "actorType" "MfaRecoveryActorType" NOT NULL DEFAULT 'SUPER_ADMIN_PEER',
    "actorId" TEXT,
    "actorEmail" TEXT NOT NULL,
    "actorIdentifier" TEXT,
    "targetId" TEXT NOT NULL,
    "targetEmail" TEXT NOT NULL,
    "targetRoleSnapshot" "AdminRole" NOT NULL,
    "status" "MfaRecoveryStatus" NOT NULL DEFAULT 'PENDING',
    "justification" TEXT NOT NULL,
    "factorId" TEXT,
    "failureCategory" TEXT,
    "failureReason" TEXT,
    "reconciliationNotes" TEXT,
    "reconciledAt" TIMESTAMP(3),
    "reconciledByActorId" TEXT,
    "initiatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "factorDeletedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdminMfaRecovery_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AdminMfaRecovery_targetId_status_idx" ON "AdminMfaRecovery"("targetId", "status");

-- CreateIndex
CREATE INDEX "AdminMfaRecovery_status_createdAt_idx" ON "AdminMfaRecovery"("status", "createdAt" DESC);

-- Partial Unique Index for Active Recovery Concurrency Control
CREATE UNIQUE INDEX "unique_active_admin_mfa_recovery" ON "AdminMfaRecovery"("targetId") WHERE "status" IN ('PENDING', 'FACTOR_DELETED', 'RECONCILIATION_REQUIRED');

-- AddForeignKey
ALTER TABLE "AdminMfaRecovery" ADD CONSTRAINT "AdminMfaRecovery_targetId_fkey" FOREIGN KEY ("targetId") REFERENCES "AdminProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminMfaRecovery" ADD CONSTRAINT "AdminMfaRecovery_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "AdminProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
