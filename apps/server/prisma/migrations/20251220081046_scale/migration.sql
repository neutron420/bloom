-- CreateIndex
CREATE INDEX "meeting_participants_meetingId_leftAt_idx" ON "meeting_participants"("meetingId", "leftAt");

-- CreateIndex
CREATE INDEX "meeting_participants_userId_idx" ON "meeting_participants"("userId");

-- CreateIndex
CREATE INDEX "users_name_idx" ON "users"("name");

-- CreateIndex
CREATE INDEX "users_email_idx" ON "users"("email");
