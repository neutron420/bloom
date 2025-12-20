-- CreateTable
CREATE TABLE "screen_shares" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "meetingId" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "stoppedAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "screen_shares_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "screen_shares_meetingId_isActive_idx" ON "screen_shares"("meetingId", "isActive");

-- CreateIndex
CREATE INDEX "screen_shares_userId_idx" ON "screen_shares"("userId");

-- AddForeignKey
ALTER TABLE "screen_shares" ADD CONSTRAINT "screen_shares_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "screen_shares" ADD CONSTRAINT "screen_shares_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "meetings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
