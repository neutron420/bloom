import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { optionalAuth } from "../middleware/auth.js";
import type { AuthRequest } from "../middleware/auth.js";
import { asyncHandler } from "../middleware/errorHandler.js";
import { logger } from "../utils/logger.js";

const router = Router();

/**
 * @swagger
 * /api/users:
 *   get:
 *     summary: Get all users
 *     tags: [Users]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *           maximum: 100
 *         description: Number of items per page
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of users with pagination
 *       500:
 *         description: Server error
 */
router.get("/users", optionalAuth, asyncHandler(async (req: AuthRequest, res) => {
  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
  const skip = (page - 1) * limit;

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      skip,
      take: limit,
      include: {
        meetings: {
          include: {
            meeting: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    }),
    prisma.user.count(),
  ]);

  res.json({
    data: users,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      hasNext: page * limit < total,
      hasPrev: page > 1,
    },
  });
}));

/**
 * @swagger
 * /api/meetings:
 *   get:
 *     summary: Get all meetings
 *     tags: [Meetings]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *           maximum: 100
 *         description: Number of items per page
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of meetings with pagination
 *       500:
 *         description: Server error
 */
router.get("/meetings", optionalAuth, asyncHandler(async (req: AuthRequest, res) => {
  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
  const skip = (page - 1) * limit;

  const [meetings, total] = await Promise.all([
    prisma.meeting.findMany({
      skip,
      take: limit,
      include: {
        participants: {
          include: {
            user: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    }),
    prisma.meeting.count(),
  ]);

  res.json({
    data: meetings,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      hasNext: page * limit < total,
      hasPrev: page > 1,
    },
  });
}));

/**
 * @swagger
 * /api/meetings/create:
 *   post:
 *     summary: Create a new meeting
 *     tags: [Meetings]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Meeting created successfully
 *       401:
 *         description: Unauthorized
 */
router.post("/meetings/create", optionalAuth, asyncHandler(async (req: AuthRequest, res) => {
  logger.info("POST /api/meetings/create - Route hit!", { 
    userId: req.user?.userId,
    hasAuth: !!req.user 
  });
  
  // Generate a unique room ID
  let roomId = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  
  // Ensure roomId is unique (check if it exists)
  let existingMeeting = await prisma.meeting.findUnique({
    where: { roomId },
  });
  
  // If roomId exists, generate a new one (very unlikely but safe)
  while (existingMeeting) {
    roomId = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    existingMeeting = await prisma.meeting.findUnique({
      where: { roomId },
    });
  }
  
  // Create meeting
  const meeting = await prisma.meeting.create({
    data: {
      roomId,
      title: `Bloom Meeting ${roomId.substring(0, 8)}`,
    },
    select: {
      id: true,
      roomId: true,
      title: true,
      createdAt: true,
    },
  });

  const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";
  logger.info("Meeting created successfully", { roomId, meetingId: meeting.id });
  
  res.json({
    message: "Meeting created successfully",
    meeting,
    meetingUrl: `${frontendUrl}/meet/${roomId}`,
  });
}));

/**
 * @swagger
 * /api/meetings/{roomId}:
 *   get:
 *     summary: Get meeting by room ID
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
 *         description: Meeting details
 *       404:
 *         description: Meeting not found
 *       500:
 *         description: Server error
 */
router.get("/meetings/:roomId", optionalAuth, asyncHandler(async (req: AuthRequest, res) => {
  const { roomId } = req.params;
  if (!roomId) {
    return res.status(400).json({ error: "Room ID is required" });
  }
  const meeting = await prisma.meeting.findUnique({
    where: { roomId },
    include: {
      participants: {
        where: {
          leftAt: null,
        },
        include: {
          user: true,
        },
      },
    },
  });
  if (!meeting) {
    return res.status(404).json({ error: "Meeting not found" });
  }
  res.json(meeting);
}));

export default router;

