-- AlterTable
ALTER TABLE "users" ADD COLUMN     "flagReason" TEXT,
ADD COLUMN     "flagged" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "flaggedAt" TIMESTAMP(3),
ADD COLUMN     "flaggedBy" TEXT;

-- CreateIndex
CREATE INDEX "users_flagged_idx" ON "users"("flagged");
