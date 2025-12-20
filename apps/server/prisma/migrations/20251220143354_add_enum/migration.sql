/*
  Warnings:

  - The `status` column on the `join_requests` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- CreateEnum
CREATE TYPE "JoinRequestStatus" AS ENUM ('pending', 'approved', 'declined');

-- AlterTable
ALTER TABLE "join_requests" DROP COLUMN "status",
ADD COLUMN     "status" "JoinRequestStatus" NOT NULL DEFAULT 'pending';

-- CreateIndex
CREATE INDEX "join_requests_meetingId_status_idx" ON "join_requests"("meetingId", "status");
