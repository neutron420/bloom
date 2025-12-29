import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { optionalAuth } from "../middleware/auth.js";
import type { AuthRequest } from "../middleware/auth.js";
import { asyncHandler } from "../middleware/errorHandler.js";

const router = Router();

/**
 * @swagger
 * /api/meetings/{roomId}/chat:
 *   get:
 *     summary: Get chat history for a meeting
 *     tags: [Chat]
 *     parameters:
 *       - in: path
 *         name: roomId
 *         required: true
 *         schema:
 *           type: string
 *         description: Meeting room ID
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *         description: Maximum number of messages to return
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Chat history
 *       404:
 *         description: Meeting not found
 *       500:
 *         description: Server error
 */
router.get("/meetings/:roomId/chat", optionalAuth, asyncHandler(async (req: AuthRequest, res) => {
  const { roomId } = req.params;
  
  if (!roomId) {
    return res.status(400).json({ error: "Room ID is required" });
  }

  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 50));

  // Get meeting
  const meeting = await prisma.meeting.findUnique({
    where: { roomId },
    select: { id: true },
  });

    if (!meeting) {
      return res.status(404).json({ error: "Meeting not found" });
    }

    // Get chat messages
    const messages = await prisma.chatMessage.findMany({
      where: {
        meetingId: meeting.id,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: {
        createdAt: "asc",
      },
      take: Math.min(limit, 100), // Max 100 messages
    });

    const chatHistory = messages.map((msg: typeof messages[0]) => ({
      id: msg.id,
      userId: msg.userId,
      userName: msg.user.name,
      message: msg.message,
      createdAt: msg.createdAt,
    }));

  res.json({
    roomId,
    messages: chatHistory,
    count: chatHistory.length,
  });
}));

/**
 * @swagger
 * /api/chat/{messageId}:
 *   delete:
 *     summary: Delete a chat message (host or owner only)
 *     tags: [Chat]
 *     parameters:
 *       - in: path
 *         name: messageId
 *         required: true
 *         schema:
 *           type: string
 *         description: Message ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - userId
 *             properties:
 *               userId:
 *                 type: string
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Message deleted successfully
 *       403:
 *         description: Not authorized
 *       404:
 *         description: Message not found
 *       500:
 *         description: Server error
 */
router.delete("/chat/:messageId", optionalAuth, asyncHandler(async (req: AuthRequest, res) => {
  const { messageId } = req.params;
  const { userId } = req.body;

  if (!messageId) {
    return res.status(400).json({ error: "Message ID is required" });
  }

  if (!userId) {
    return res.status(400).json({ error: "userId is required" });
  }

  // Get the message
  const chatMessage = await prisma.chatMessage.findUnique({
    where: { id: messageId },
      include: {
        meeting: true,
      },
    });

    if (!chatMessage) {
      return res.status(404).json({ error: "Message not found" });
    }

    // Verify user is host or message owner
    const participant = await prisma.meetingParticipant.findUnique({
      where: {
        userId_meetingId: {
          userId,
          meetingId: chatMessage.meetingId,
        },
      },
      select: { isHost: true },
    });

    const isHost = participant?.isHost === true;
    const isOwner = chatMessage.userId === userId;

    if (!isHost && !isOwner) {
      return res.status(403).json({ error: "Not authorized to delete this message" });
    }

    // Delete message
    await prisma.chatMessage.delete({
      where: { id: messageId },
    });

  res.json({
    message: "Message deleted successfully",
    messageId,
  });
}));

export default router;

