import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { authenticate, optionalAuth } from "../middleware/auth.js";
import type { AuthRequest } from "../middleware/auth.js";
import { z } from "zod";
import { asyncHandler } from "../middleware/errorHandler.js";

const router = Router();

const updateApprovalSchema = z.object({
  requiresApproval: z.boolean(),
});

/**
 * @swagger
 * /api/meetings/{roomId}/approval:
 *   patch:
 *     summary: Enable/disable approval requirement for a meeting (host only)
 *     tags: [Meetings]
 *     parameters:
 *       - in: path
 *         name: roomId
 *         required: true
 *         schema:
 *           type: string
 *         description: Meeting room ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - requiresApproval
 *             properties:
 *               requiresApproval:
 *                 type: boolean
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Meeting settings updated
 *       400:
 *         description: Validation error
 *       403:
 *         description: Not authorized (host only)
 *       404:
 *         description: Meeting not found
 */
router.patch("/meetings/:roomId/approval", authenticate, asyncHandler(async (req: AuthRequest, res) => {
  const { roomId } = req.params;
  
  if (!roomId) {
    return res.status(400).json({ error: "Room ID is required" });
  }

  if (!req.user) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const validated = updateApprovalSchema.parse(req.body);
  const { requiresApproval } = validated;

  // Get meeting
  const meeting = await prisma.meeting.findUnique({
    where: { roomId },
  });

  if (!meeting) {
    return res.status(404).json({ error: "Meeting not found" });
  }

  // Verify user is host
  const participant = await prisma.meetingParticipant.findUnique({
    where: {
      userId_meetingId: {
        userId: req.user.userId,
        meetingId: meeting.id,
      },
    },
  });

  if (!participant || !participant.isHost || participant.leftAt) {
    return res.status(403).json({ error: "Only hosts can change meeting settings" });
  }

  // Update meeting
  const updatedMeeting = await prisma.meeting.update({
    where: { roomId },
    data: { requiresApproval },
    select: { id: true, roomId: true, requiresApproval: true },
  });

  res.json({
    message: `Meeting approval requirement ${requiresApproval ? "enabled" : "disabled"}`,
    meeting: updatedMeeting,
  });
}));

/**
 * @swagger
 * /api/meetings/{roomId}/settings:
 *   get:
 *     summary: Get meeting settings
 *     tags: [Meetings]
 *     parameters:
 *       - in: path
 *         name: roomId
 *         required: true
 *         schema:
 *           type: string
 *         description: Meeting room ID
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Meeting settings
 *       404:
 *         description: Meeting not found
 */
router.get("/meetings/:roomId/settings", optionalAuth, asyncHandler(async (req: AuthRequest, res) => {
  const { roomId } = req.params;

  if (!roomId) {
    return res.status(400).json({ error: "Room ID is required" });
  }

  const meeting = await prisma.meeting.findUnique({
    where: { roomId },
    select: {
      id: true,
      roomId: true,
      title: true,
      requiresApproval: true,
      createdAt: true,
    },
  });

  if (!meeting) {
    return res.status(404).json({ error: "Meeting not found" });
  }

  res.json(meeting);
}));

export default router;

