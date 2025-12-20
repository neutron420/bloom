-- AlterTable
ALTER TABLE "meeting_participants" ADD COLUMN     "isHost" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "meetings" ADD COLUMN     "requiresApproval" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "join_requests" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "meetingId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "respondedAt" TIMESTAMP(3),

    CONSTRAINT "join_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "join_requests_meetingId_status_idx" ON "join_requests"("meetingId", "status");

-- CreateIndex
CREATE INDEX "join_requests_userId_idx" ON "join_requests"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "join_requests_userId_meetingId_key" ON "join_requests"("userId", "meetingId");

-- CreateIndex
CREATE INDEX "meeting_participants_meetingId_isHost_idx" ON "meeting_participants"("meetingId", "isHost");

-- AddForeignKey
ALTER TABLE "join_requests" ADD CONSTRAINT "join_requests_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "join_requests" ADD CONSTRAINT "join_requests_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "meetings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
