-- AlterTable
ALTER TABLE "users" ADD COLUMN     "suspended" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "suspendedAt" TIMESTAMP(3),
ADD COLUMN     "suspendedBy" TEXT,
ADD COLUMN     "suspensionReason" TEXT;

-- CreateIndex
CREATE INDEX "users_suspended_idx" ON "users"("suspended");
