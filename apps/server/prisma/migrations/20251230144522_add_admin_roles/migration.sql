-- CreateEnum
CREATE TYPE "AdminRole" AS ENUM ('MAIN_ADMIN', 'SUPER_ADMIN');

-- AlterTable
ALTER TABLE "admins" ADD COLUMN     "createdBy" TEXT,
ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "role" "AdminRole" NOT NULL DEFAULT 'SUPER_ADMIN';

-- CreateIndex
CREATE INDEX "admins_role_idx" ON "admins"("role");

-- CreateIndex
CREATE INDEX "admins_isActive_idx" ON "admins"("isActive");
