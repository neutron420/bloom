import { Router, type Response } from "express";
import { Server } from "socket.io";
import { prisma } from "../../lib/prisma.js";
import { requireAdmin } from "../middleware/adminAuth.js";
import type { AdminRequest } from "../middleware/adminAuth.js";
import { asyncHandler } from "../../middleware/errorHandler.js";
import { socketConnections, rooms } from "../../store/connectionStore.js";
import { logger } from "../../utils/logger.js";
import { getAdminNamespace, emitUserLeft } from "../handlers/adminHandlers.js";
import { cleanupMediaSoupResources } from "../../config/mediasoup.js";
import { Prisma } from "@prisma/client";

const router = Router();

// Store io instance (will be set by setupAdminRoutes)
let ioInstance: Server | null = null;

export function setupAdminRoutes(io: Server): Router {
  ioInstance = io;
  return router;
}

/**
 * Helper function to log admin activities
 */
async function logAdminActivity(
  adminId: string,
  action: string,
  targetType?: string,
  targetId?: string,
  details?: any,
  ipAddress?: string
): Promise<void> {
  try {
    await prisma.adminActivityLog.create({
      data: {
        adminId,
        action,
        targetType: targetType || null,
        targetId: targetId || null,
        details: details ? JSON.stringify(details) : null,
        ipAddress: ipAddress || null,
      },
    });
  } catch (error) {
    logger.error("Failed to log admin activity", { error, adminId, action });
  }
}

// All admin routes require admin authentication
router.use(requireAdmin);

/**
 * GET /api/admin/stats
 * Get real-time statistics
 */
router.get("/stats", asyncHandler(async (req: AdminRequest, res) => {
  const totalConnections = Object.keys(socketConnections).length;
  const activeRooms = Object.keys(rooms).length;

  // Get database stats
  const [totalUsers, totalMeetings, activeMeetings, totalJoinRequests] = await Promise.all([
    prisma.user.count(),
    prisma.meeting.count(),
    prisma.meetingParticipant.count({
      where: { leftAt: null },
    }),
    prisma.joinRequest.count(),
  ]);

  const roomStats = Object.entries(rooms).map(([roomId, participants]) => ({
    roomId,
    participantCount: Object.keys(participants).length,
  }));

  res.json({
    timestamp: new Date().toISOString(),
    connections: {
      active: totalConnections,
      total: totalConnections,
    },
    rooms: {
      active: activeRooms,
      total: totalMeetings,
      activeMeetings,
      roomStats,
    },
    users: {
      total: totalUsers,
    },
    requests: {
      total: totalJoinRequests,
    },
  });
}));


router.get("/users", asyncHandler(async (req: AdminRequest, res) => {
  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
  const skip = (page - 1) * limit;
  const search = req.query.search as string | undefined;
  const isAdminFilter = req.query.isAdmin === "true" ? true : req.query.isAdmin === "false" ? false : undefined;

  const where: Prisma.UserWhereInput = {};
  if (search) {
    where.OR = [
      { name: { contains: search, mode: "insensitive" } },
      { email: { contains: search, mode: "insensitive" } },
    ];
  }
  if (isAdminFilter !== undefined) {
    where.isAdmin = isAdminFilter;
  }

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      skip,
      take: limit,
      select: {
        id: true,
        name: true,
        email: true,
        isAdmin: true,
        profilePicture: true,
        adminAssignedAt: true,
        adminAssignedBy: true,
        createdAt: true,
        _count: {
          select: {
            meetings: true,
            joinRequests: true,
            chatMessages: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    }),
    prisma.user.count({ where }),
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
 * GET /api/admin/users/:id
 * Get user details
 */
router.get("/users/:id", asyncHandler(async (req: AdminRequest, res) => {
  const { id } = req.params;
  
  if (!id) {
    return res.status(400).json({ error: "User ID is required" });
  }

  const user = await prisma.user.findUnique({
    where: { id },
    include: {
      meetings: {
        include: {
          meeting: {
            select: {
              id: true,
              roomId: true,
              title: true,
              createdAt: true,
            },
          },
        },
        orderBy: {
          joinedAt: "desc",
        },
        take: 10,
      },
      joinRequests: {
        include: {
          meeting: {
            select: {
              id: true,
              roomId: true,
              title: true,
            },
          },
        },
        orderBy: {
          requestedAt: "desc",
        },
        take: 10,
      },
    },
  });

  if (!user) {
    return res.status(404).json({ error: "User not found" });
  }

  res.json({ user });
}));

/**
 * PATCH /api/admin/users/:id/ban
 * Ban a user (placeholder - add banned field to schema later)
 */
router.patch("/users/:id/ban", asyncHandler(async (req: AdminRequest, res) => {
  const { id } = req.params;
  
  if (!id) {
    return res.status(400).json({ error: "User ID is required" });
  }

  const user = await prisma.user.findUnique({
    where: { id },
  });

  if (!user) {
    return res.status(404).json({ error: "User not found" });
  }

  if (user.isAdmin) {
    return res.status(400).json({ error: "Cannot ban an admin user" });
  }

  // TODO: Add banned field to User model in schema.prisma
  logger.info(`User banned by admin`, { userId: id, adminId: req.admin?.userId });

  res.json({
    message: "User banned successfully (Note: banned field not yet implemented in schema)",
    user: user,
  });
}));

/**
 * PATCH /api/admin/users/:id/make-admin
 * Make a user an admin
 */
router.patch("/users/:id/make-admin", asyncHandler(async (req: AdminRequest, res) => {
  const { id } = req.params;
  
  if (!id) {
    return res.status(400).json({ error: "User ID is required" });
  }

  const user = await prisma.user.findUnique({
    where: { id },
  });

  if (!user) {
    return res.status(404).json({ error: "User not found" });
  }

  const updatedUser = await prisma.user.update({
    where: { id },
    data: {
      isAdmin: true,
      adminAssignedAt: new Date(),
      adminAssignedBy: req.admin?.userId || null,
    },
  });

  logger.info(`User made admin`, { userId: id, adminId: req.admin?.userId });

  res.json({
    message: "User is now an admin",
    user: updatedUser,
  });
}));

/**
 * PATCH /api/admin/users/:id/remove-admin
 * Remove admin status from user
 */
router.patch("/users/:id/remove-admin", asyncHandler(async (req: AdminRequest, res) => {
  const { id } = req.params;
  
  if (!id) {
    return res.status(400).json({ error: "User ID is required" });
  }

  if (id === req.admin?.userId) {
    return res.status(400).json({ error: "Cannot remove admin status from yourself" });
  }

  const user = await prisma.user.findUnique({
    where: { id },
  });

  if (!user) {
    return res.status(404).json({ error: "User not found" });
  }

  const updatedUser = await prisma.user.update({
    where: { id },
    data: {
      isAdmin: false,
      adminAssignedAt: null,
      adminAssignedBy: null,
    },
  });

  logger.info(`Admin status removed from user`, { userId: id, adminId: req.admin?.userId });

  res.json({
    message: "Admin status removed",
    user: updatedUser,
  });
}));


router.get("/meetings", asyncHandler(async (req: AdminRequest, res) => {
  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
  const skip = (page - 1) * limit;
  const active = req.query.active === "true";

  const where: Prisma.MeetingWhereInput = {};
  if (active) {
    where.participants = {
      some: {
        leftAt: null,
      },
    };
  }

  const participantsWhere: Prisma.MeetingParticipantWhereInput | undefined = active 
    ? { leftAt: null } 
    : undefined;

  const [meetings, total] = await Promise.all([
    prisma.meeting.findMany({
      where,
      skip,
      take: limit,
      include: {
        participants: {
          ...(participantsWhere && { where: participantsWhere }),
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
        _count: {
          select: {
            participants: true,
            joinRequests: true,
            chatMessages: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    }),
    prisma.meeting.count({ where }),
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
 * GET /api/admin/meetings/:id
 * Get meeting details
 */
router.get("/meetings/:id", asyncHandler(async (req: AdminRequest, res) => {
  const { id } = req.params;
  
  if (!id) {
    return res.status(400).json({ error: "Meeting ID is required" });
  }

  const meeting = await prisma.meeting.findUnique({
    where: { id },
    include: {
      participants: {
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
        orderBy: {
          joinedAt: "desc",
        },
      },
      joinRequests: {
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
        orderBy: {
          requestedAt: "desc",
        },
      },
      chatMessages: {
        take: 50,
        orderBy: {
          createdAt: "desc",
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      },
    },
  });

  if (!meeting) {
    return res.status(404).json({ error: "Meeting not found" });
  }

  res.json({ meeting });
}));

/**
 * DELETE /api/admin/users/:id
 * Delete a user permanently
 */
router.delete("/users/:id", asyncHandler(async (req: AdminRequest, res) => {
  const { id } = req.params;
  
  if (!id) {
    return res.status(400).json({ error: "User ID is required" });
  }

  const user = await prisma.user.findUnique({
    where: { id },
  });

  if (!user) {
    return res.status(404).json({ error: "User not found" });
  }

  if (user.isAdmin) {
    return res.status(400).json({ error: "Cannot delete an admin user" });
  }

  // Disconnect all socket connections for this user
  if (ioInstance) {
    const userSockets = Object.entries(socketConnections)
      .filter(([_, conn]) => conn.userId === id)
      .map(([socketId]) => socketId);

    for (const socketId of userSockets) {
      const socket = ioInstance.sockets.sockets.get(socketId);
      if (socket) {
        // Cleanup MediaSoup resources
        cleanupMediaSoupResources(socketId);
        socket.disconnect(true);
      }
      delete socketConnections[socketId];
    }
  }

  // Delete user (cascade will delete meetings, messages, etc.)
  await prisma.user.delete({
    where: { id },
  });

  await logAdminActivity(
    req.admin?.userId || "unknown",
    "user_deleted",
    "user",
    id,
    { userName: user.name, userEmail: user.email },
    req.ip
  );

  logger.info(`User deleted by admin`, { userId: id, adminId: req.admin?.userId });

  res.json({
    message: "User deleted successfully",
  });
}));

/**
 * PATCH /api/admin/users/:id
 * Update user details
 */
router.patch("/users/:id", asyncHandler(async (req: AdminRequest, res) => {
  const { id } = req.params;
  const { name, email, profilePicture } = req.body;
  
  if (!id) {
    return res.status(400).json({ error: "User ID is required" });
  }

  const user = await prisma.user.findUnique({
    where: { id },
  });

  if (!user) {
    return res.status(404).json({ error: "User not found" });
  }

  // Check email uniqueness if email is being updated
  if (email && email !== user.email) {
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });
    if (existingUser) {
      return res.status(409).json({ error: "Email already in use" });
    }
  }

  const updateData: Prisma.UserUpdateInput = {};
  if (name !== undefined) updateData.name = name;
  if (email !== undefined) updateData.email = email;
  if (profilePicture !== undefined) updateData.profilePicture = profilePicture;

  const updatedUser = await prisma.user.update({
    where: { id },
    data: updateData,
  });

  await logAdminActivity(
    req.admin?.userId || "unknown",
    "user_updated",
    "user",
    id,
    updateData,
    req.ip
  );

  logger.info(`User updated by admin`, { userId: id, adminId: req.admin?.userId, updates: Object.keys(updateData) });

  res.json({
    message: "User updated successfully",
    user: updatedUser,
  });
}));

/**
 * GET /api/admin/users/:id/activity
 * Get user activity log
 */
router.get("/users/:id/activity", asyncHandler(async (req: AdminRequest, res) => {
  const { id } = req.params;
  
  if (!id) {
    return res.status(400).json({ error: "User ID is required" });
  }

  const user = await prisma.user.findUnique({
    where: { id },
    select: { id: true, name: true, email: true, createdAt: true },
  });

  if (!user) {
    return res.status(404).json({ error: "User not found" });
  }

  // Get user statistics
  const [
    totalMeetings,
    totalMessages,
    totalJoinRequests,
    totalScreenShares,
    lastMeeting,
    recentMessages,
  ] = await Promise.all([
    prisma.meetingParticipant.count({
      where: { userId: id },
    }),
    prisma.chatMessage.count({
      where: { userId: id },
    }),
    prisma.joinRequest.count({
      where: { userId: id },
    }),
    prisma.screenShare.count({
      where: { userId: id },
    }),
    prisma.meetingParticipant.findFirst({
      where: { userId: id },
      orderBy: { joinedAt: "desc" },
      include: {
        meeting: {
          select: {
            id: true,
            roomId: true,
            title: true,
            createdAt: true,
          },
        },
      },
    }),
    prisma.chatMessage.findMany({
      where: { userId: id },
      orderBy: { createdAt: "desc" },
      take: 10,
      include: {
        meeting: {
          select: {
            id: true,
            roomId: true,
            title: true,
          },
        },
      },
    }),
  ]);

  res.json({
    user,
    activity: {
      totalMeetings,
      totalMessages,
      totalJoinRequests,
      totalScreenShares,
      lastMeeting: lastMeeting ? {
        meeting: lastMeeting.meeting,
        joinedAt: lastMeeting.joinedAt,
        leftAt: lastMeeting.leftAt,
      } : null,
      recentMessages: recentMessages.map(msg => ({
        id: msg.id,
        message: msg.message,
        meeting: msg.meeting,
        createdAt: msg.createdAt,
      })),
    },
  });
}));

/**
 * DELETE /api/admin/meetings/:id
 * End/delete a meeting
 */
router.delete("/meetings/:id", asyncHandler(async (req: AdminRequest, res) => {
  const { id } = req.params;
  
  if (!id) {
    return res.status(400).json({ error: "Meeting ID is required" });
  }

  const meeting = await prisma.meeting.findUnique({
    where: { id },
    include: {
      participants: {
        where: { leftAt: null },
        select: { userId: true },
      },
    },
  });

  if (!meeting) {
    return res.status(404).json({ error: "Meeting not found" });
  }

  // Disconnect all active participants
  if (ioInstance) {
    const activeUserIds = new Set(meeting.participants.map(p => p.userId));
    const socketsToDisconnect = Object.entries(socketConnections)
      .filter(([_, conn]) => conn.meetingDbId === id)
      .map(([socketId]) => socketId);

    for (const socketId of socketsToDisconnect) {
      const socket = ioInstance.sockets.sockets.get(socketId);
      if (socket) {
        // Cleanup MediaSoup resources
        cleanupMediaSoupResources(socketId);
        // Emit meeting ended event
        socket.emit("meeting-ended", {
          message: "Meeting was ended by an administrator",
          meetingId: id,
          roomId: meeting.roomId,
        });
        socket.disconnect(true);
      }
      delete socketConnections[socketId];
    }

    // Clean up room
    if (rooms[meeting.roomId]) {
      delete rooms[meeting.roomId];
    }

    // Emit admin event
    const adminNamespace = getAdminNamespace(ioInstance);
    if (adminNamespace) {
      adminNamespace.emit("meeting-ended", {
        meetingId: id,
        roomId: meeting.roomId,
        endedBy: req.admin?.userId,
        timestamp: new Date().toISOString(),
      });
    }
  }

  // Mark all participants as left
  await prisma.meetingParticipant.updateMany({
    where: {
      meetingId: id,
      leftAt: null,
    },
    data: {
      leftAt: new Date(),
    },
  });

  // Delete meeting (cascade will delete participants, requests, etc.)
  await prisma.meeting.delete({
    where: { id },
  });

  await logAdminActivity(
    req.admin?.userId || "unknown",
    "meeting_ended",
    "meeting",
    id,
    { roomId: meeting.roomId, participantsDisconnected: meeting.participants.length },
    req.ip
  );

  logger.info(`Meeting ended by admin`, { meetingId: id, roomId: meeting.roomId, adminId: req.admin?.userId });

  res.json({
    message: "Meeting ended successfully",
  });
}));

/**
 * POST /api/admin/meetings/:id/end
 * Force end a meeting (alternative endpoint)
 */
router.post("/meetings/:id/end", asyncHandler(async (req: AdminRequest, res) => {
  const { id } = req.params;
  
  if (!id) {
    return res.status(400).json({ error: "Meeting ID is required" });
  }

  const meeting = await prisma.meeting.findUnique({
    where: { id },
    include: {
      participants: {
        where: { leftAt: null },
        select: { userId: true },
      },
    },
  });

  if (!meeting) {
    return res.status(404).json({ error: "Meeting not found" });
  }

  // Disconnect all active participants
  if (ioInstance) {
    const socketsToDisconnect = Object.entries(socketConnections)
      .filter(([_, conn]) => conn.meetingDbId === id)
      .map(([socketId]) => socketId);

    for (const socketId of socketsToDisconnect) {
      const socket = ioInstance.sockets.sockets.get(socketId);
      if (socket) {
        cleanupMediaSoupResources(socketId);
        socket.emit("meeting-ended", {
          message: "Meeting was ended by an administrator",
          meetingId: id,
          roomId: meeting.roomId,
        });
        socket.disconnect(true);
      }
      delete socketConnections[socketId];
    }

    if (rooms[meeting.roomId]) {
      delete rooms[meeting.roomId];
    }

    const adminNamespace = getAdminNamespace(ioInstance);
    if (adminNamespace) {
      adminNamespace.emit("meeting-ended", {
        meetingId: id,
        roomId: meeting.roomId,
        endedBy: req.admin?.userId,
        timestamp: new Date().toISOString(),
      });
    }
  }

  // Mark all participants as left
  await prisma.meetingParticipant.updateMany({
    where: {
      meetingId: id,
      leftAt: null,
    },
    data: {
      leftAt: new Date(),
    },
  });

  logger.info(`Meeting force ended by admin`, { meetingId: id, roomId: meeting.roomId, adminId: req.admin?.userId });

  res.json({
    message: "Meeting ended successfully",
    meeting: {
      id: meeting.id,
      roomId: meeting.roomId,
      participantsDisconnected: meeting.participants.length,
    },
  });
}));

/**
 * GET /api/admin/meetings/:id/analytics
 * Get meeting analytics
 */
router.get("/meetings/:id/analytics", asyncHandler(async (req: AdminRequest, res) => {
  const { id } = req.params;
  
  if (!id) {
    return res.status(400).json({ error: "Meeting ID is required" });
  }

  const meeting = await prisma.meeting.findUnique({
    where: { id },
    include: {
      participants: {
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      },
      _count: {
        select: {
          participants: true,
          chatMessages: true,
          joinRequests: true,
          screenShares: true,
        },
      },
    },
  });

  if (!meeting) {
    return res.status(404).json({ error: "Meeting not found" });
  }

  // Calculate analytics
  const participants = meeting.participants;
  const activeParticipants = participants.filter(p => !p.leftAt);
  const peakParticipants = participants.length;
  
  // Calculate meeting duration (if ended)
  const firstJoin = participants.length > 0 && participants[0]
    ? participants.reduce((earliest, p) => 
        p.joinedAt < earliest ? p.joinedAt : earliest, 
        participants[0]!.joinedAt
      )
    : meeting.createdAt;
  
  const lastLeave = participants.length > 0
    ? participants
        .filter(p => p.leftAt)
        .reduce((latest, p) => 
          p.leftAt && p.leftAt > latest ? p.leftAt : latest, 
          firstJoin
        )
    : null;

  const duration = lastLeave 
    ? Math.floor((lastLeave.getTime() - firstJoin.getTime()) / 1000) // seconds
    : Math.floor((Date.now() - firstJoin.getTime()) / 1000);

  // Calculate average session duration per participant
  const sessionDurations = participants
    .filter(p => p.leftAt)
    .map(p => {
      const sessionDuration = p.leftAt!.getTime() - p.joinedAt.getTime();
      return Math.floor(sessionDuration / 1000); // seconds
    });

  const avgSessionDuration = sessionDurations.length > 0
    ? Math.floor(sessionDurations.reduce((sum, d) => sum + d, 0) / sessionDurations.length)
    : 0;

  res.json({
    meeting: {
      id: meeting.id,
      roomId: meeting.roomId,
      title: meeting.title,
      createdAt: meeting.createdAt,
      requiresApproval: meeting.requiresApproval,
    },
    analytics: {
      duration: {
        total: duration,
        formatted: formatDuration(duration),
        startedAt: firstJoin,
        endedAt: lastLeave,
        isActive: !lastLeave,
      },
      participants: {
        total: meeting._count.participants,
        active: activeParticipants.length,
        peak: peakParticipants,
        averageSessionDuration: avgSessionDuration,
        averageSessionDurationFormatted: formatDuration(avgSessionDuration),
      },
      messages: {
        total: meeting._count.chatMessages,
      },
      joinRequests: {
        total: meeting._count.joinRequests,
      },
      screenShares: {
        total: meeting._count.screenShares,
      },
      participantsList: activeParticipants.map(p => ({
        user: p.user,
        joinedAt: p.joinedAt,
        leftAt: p.leftAt,
        isHost: p.isHost,
      })),
    },
  });
}));

/**
 * PATCH /api/admin/meetings/:id/settings
 * Update meeting settings
 */
router.patch("/meetings/:id/settings", asyncHandler(async (req: AdminRequest, res) => {
  const { id } = req.params;
  const { title, requiresApproval } = req.body;
  
  if (!id) {
    return res.status(400).json({ error: "Meeting ID is required" });
  }

  const meeting = await prisma.meeting.findUnique({
    where: { id },
  });

  if (!meeting) {
    return res.status(404).json({ error: "Meeting not found" });
  }

  const updateData: Prisma.MeetingUpdateInput = {};
  if (title !== undefined) updateData.title = title;
  if (requiresApproval !== undefined) updateData.requiresApproval = requiresApproval;

  const updatedMeeting = await prisma.meeting.update({
    where: { id },
    data: updateData,
  });

  // Notify meeting participants about settings change
  if (ioInstance) {
    ioInstance.to(meeting.roomId).emit("meeting-settings-updated", {
      meetingId: id,
      roomId: meeting.roomId,
      title: updatedMeeting.title,
      requiresApproval: updatedMeeting.requiresApproval,
      updatedBy: req.admin?.userId,
    });
  }

  await logAdminActivity(
    req.admin?.userId || "unknown",
    "meeting_settings_updated",
    "meeting",
    id,
    updateData,
    req.ip
  );

  logger.info(`Meeting settings updated by admin`, { 
    meetingId: id, 
    roomId: meeting.roomId,
    updates: Object.keys(updateData),
    adminId: req.admin?.userId 
  });

  res.json({
    message: "Meeting settings updated successfully",
    meeting: updatedMeeting,
  });
}));

/**
 * Helper function to format duration
 */
function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  
  if (hours > 0) {
    return `${hours}h ${minutes}m ${secs}s`;
  } else if (minutes > 0) {
    return `${minutes}m ${secs}s`;
  } else {
    return `${secs}s`;
  }
}

/**
 * GET /api/admin/join-requests
 * Get all join requests
 */
router.get("/join-requests", asyncHandler(async (req: AdminRequest, res) => {
  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
  const skip = (page - 1) * limit;
  const status = req.query.status as string | undefined;

  const where: Prisma.JoinRequestWhereInput = {};
  if (status && ["pending", "approved", "declined"].includes(status)) {
    where.status = status as "pending" | "approved" | "declined";
  }

  const [requests, total] = await Promise.all([
    prisma.joinRequest.findMany({
      where,
      skip,
      take: limit,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        meeting: {
          select: {
            id: true,
            roomId: true,
            title: true,
          },
        },
      },
      orderBy: {
        requestedAt: "desc",
      },
    }),
    prisma.joinRequest.count({ where }),
  ]);

  res.json({
    data: requests,
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
 * PATCH /api/admin/join-requests/:id/approve
 * Approve a join request
 */
router.patch("/join-requests/:id/approve", asyncHandler(async (req: AdminRequest, res) => {
  const { id } = req.params;
  
  if (!id) {
    return res.status(400).json({ error: "Join request ID is required" });
  }

  const joinRequest = await prisma.joinRequest.findUnique({
    where: { id },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
      meeting: {
        select: {
          id: true,
          roomId: true,
          title: true,
        },
      },
    },
  });

  if (!joinRequest) {
    return res.status(404).json({ error: "Join request not found" });
  }

  if (joinRequest.status !== "pending") {
    return res.status(400).json({ error: `Join request is already ${joinRequest.status}` });
  }

  // Update join request status
  const updatedRequest = await prisma.joinRequest.update({
    where: { id },
    data: {
      status: "approved",
      respondedAt: new Date(),
    },
  });

  // Notify user via socket if connected
  if (ioInstance) {
    // Find user's socket connections
    const userSockets = Object.entries(socketConnections)
      .filter(([_, conn]) => conn.userId === joinRequest.userId)
      .map(([socketId]) => socketId);

    for (const socketId of userSockets) {
      const socket = ioInstance.sockets.sockets.get(socketId);
      if (socket) {
        socket.emit("join-request-approved", {
          requestId: id,
          meetingId: joinRequest.meetingId,
          roomId: joinRequest.meeting.roomId,
          meetingTitle: joinRequest.meeting.title,
        });
      }
    }

    // Emit admin event
    const adminNamespace = getAdminNamespace(ioInstance);
    if (adminNamespace) {
      adminNamespace.emit("join-request-updated", {
        requestId: id,
        status: "approved",
        userId: joinRequest.userId,
        meetingId: joinRequest.meetingId,
        approvedBy: req.admin?.userId,
        timestamp: new Date().toISOString(),
      });
    }
  }

  await logAdminActivity(
    req.admin?.userId || "unknown",
    "join_request_approved",
    "join_request",
    id,
    { userId: joinRequest.userId, meetingId: joinRequest.meetingId },
    req.ip
  );

  logger.info(`Join request approved by admin`, { 
    requestId: id, 
    userId: joinRequest.userId, 
    meetingId: joinRequest.meetingId,
    adminId: req.admin?.userId 
  });

  res.json({
    message: "Join request approved successfully",
    request: updatedRequest,
  });
}));

/**
 * PATCH /api/admin/join-requests/:id/decline
 * Decline a join request
 */
router.patch("/join-requests/:id/decline", asyncHandler(async (req: AdminRequest, res) => {
  const { id } = req.params;
  
  if (!id) {
    return res.status(400).json({ error: "Join request ID is required" });
  }

  const joinRequest = await prisma.joinRequest.findUnique({
    where: { id },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
      meeting: {
        select: {
          id: true,
          roomId: true,
          title: true,
        },
      },
    },
  });

  if (!joinRequest) {
    return res.status(404).json({ error: "Join request not found" });
  }

  if (joinRequest.status !== "pending") {
    return res.status(400).json({ error: `Join request is already ${joinRequest.status}` });
  }

  // Update join request status
  const updatedRequest = await prisma.joinRequest.update({
    where: { id },
    data: {
      status: "declined",
      respondedAt: new Date(),
    },
  });

  // Notify user via socket if connected
  if (ioInstance) {
    const userSockets = Object.entries(socketConnections)
      .filter(([_, conn]) => conn.userId === joinRequest.userId)
      .map(([socketId]) => socketId);

    for (const socketId of userSockets) {
      const socket = ioInstance.sockets.sockets.get(socketId);
      if (socket) {
        socket.emit("join-request-declined", {
          requestId: id,
          meetingId: joinRequest.meetingId,
          roomId: joinRequest.meeting.roomId,
          meetingTitle: joinRequest.meeting.title,
        });
      }
    }

    // Emit admin event
    const adminNamespace = getAdminNamespace(ioInstance);
    if (adminNamespace) {
      adminNamespace.emit("join-request-updated", {
        requestId: id,
        status: "declined",
        userId: joinRequest.userId,
        meetingId: joinRequest.meetingId,
        declinedBy: req.admin?.userId,
        timestamp: new Date().toISOString(),
      });
    }
  }

  await logAdminActivity(
    req.admin?.userId || "unknown",
    "join_request_declined",
    "join_request",
    id,
    { userId: joinRequest.userId, meetingId: joinRequest.meetingId },
    req.ip
  );

  logger.info(`Join request declined by admin`, { 
    requestId: id, 
    userId: joinRequest.userId, 
    meetingId: joinRequest.meetingId,
    adminId: req.admin?.userId 
  });

  res.json({
    message: "Join request declined successfully",
    request: updatedRequest,
  });
}));

/**
 * POST /api/admin/join-requests/bulk-action
 * Approve or decline multiple join requests at once
 */
router.post("/join-requests/bulk-action", asyncHandler(async (req: AdminRequest, res) => {
  const { requestIds, action } = req.body;
  
  if (!Array.isArray(requestIds) || requestIds.length === 0) {
    return res.status(400).json({ error: "requestIds must be a non-empty array" });
  }

  if (!action || !["approve", "decline"].includes(action)) {
    return res.status(400).json({ error: "action must be 'approve' or 'decline'" });
  }

  const status = action === "approve" ? "approved" : "declined";

  // Get all requests
  const requests = await prisma.joinRequest.findMany({
    where: {
      id: { in: requestIds },
      status: "pending",
    },
    include: {
      user: {
        select: {
          id: true,
          name: true,
        },
      },
      meeting: {
        select: {
          id: true,
          roomId: true,
          title: true,
        },
      },
    },
  });

  if (requests.length === 0) {
    return res.status(404).json({ error: "No pending join requests found with the provided IDs" });
  }

  // Update all requests
  const updatedRequests = await prisma.joinRequest.updateMany({
    where: {
      id: { in: requests.map(r => r.id) },
    },
    data: {
      status: status,
      respondedAt: new Date(),
    },
  });

  // Notify users via socket
  if (ioInstance) {
    const adminNamespace = getAdminNamespace(ioInstance);
    
    for (const request of requests) {
      const userSockets = Object.entries(socketConnections)
        .filter(([_, conn]) => conn.userId === request.userId)
        .map(([socketId]) => socketId);

      for (const socketId of userSockets) {
        const socket = ioInstance.sockets.sockets.get(socketId);
        if (socket) {
          socket.emit(action === "approve" ? "join-request-approved" : "join-request-declined", {
            requestId: request.id,
            meetingId: request.meetingId,
            roomId: request.meeting.roomId,
            meetingTitle: request.meeting.title,
          });
        }
      }

      if (adminNamespace) {
        adminNamespace.emit("join-request-updated", {
          requestId: request.id,
          status: status,
          userId: request.userId,
          meetingId: request.meetingId,
          [action === "approve" ? "approvedBy" : "declinedBy"]: req.admin?.userId,
          timestamp: new Date().toISOString(),
        });
      }
    }
  }

  logger.info(`Bulk ${action} join requests by admin`, { 
    count: updatedRequests.count,
    requestIds: requests.map(r => r.id),
    adminId: req.admin?.userId 
  });

  res.json({
    message: `${updatedRequests.count} join request(s) ${action}d successfully`,
    count: updatedRequests.count,
    action: status,
  });
}));

// ============================================================================
// PHASE 2: ANALYTICS & REPORTING
// ============================================================================

/**
 * GET /api/admin/analytics/users/growth
 * Get user growth analytics
 */
router.get("/analytics/users/growth", asyncHandler(async (req: AdminRequest, res) => {
  const period = (req.query.period as string) || "day"; // day, week, month
  const startDate = req.query.startDate ? new Date(req.query.startDate as string) : null;
  const endDate = req.query.endDate ? new Date(req.query.endDate as string) : null;

  // Default to last 30 days if no dates provided
  const defaultEndDate = endDate || new Date();
  const defaultStartDate = startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  let groupBy: string;
  let dateFormat: string;
  
  switch (period) {
    case "day":
      groupBy = "DATE(created_at)";
      dateFormat = "YYYY-MM-DD";
      break;
    case "week":
      groupBy = "DATE_TRUNC('week', created_at)";
      dateFormat = "YYYY-MM-DD";
      break;
    case "month":
      groupBy = "DATE_TRUNC('month', created_at)";
      dateFormat = "YYYY-MM";
      break;
    default:
      groupBy = "DATE(created_at)";
      dateFormat = "YYYY-MM-DD";
  }

  // Get user registrations grouped by period
  // For simplicity, get all users and group in memory for day/week/month
  const allUsers = await prisma.user.findMany({
    where: {
      createdAt: {
        gte: defaultStartDate,
        lte: defaultEndDate,
      },
    },
    select: {
      createdAt: true,
    },
    orderBy: {
      createdAt: "asc",
    },
  });

  // Group by period
  const registrationsMap = new Map<string, number>();
  allUsers.forEach(user => {
    let key: string;
    const date = new Date(user.createdAt);
    switch (period) {
      case "week":
        const weekStart = new Date(date);
        weekStart.setDate(date.getDate() - date.getDay());
        key = weekStart.toISOString().split('T')[0]!;
        break;
      case "month":
        key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        break;
      default:
        key = date.toISOString().split('T')[0]!;
    }
    registrationsMap.set(key, (registrationsMap.get(key) || 0) + 1);
  });

  const registrations = Array.from(registrationsMap.entries())
    .map(([date, count]) => ({ date: new Date(date), count: BigInt(count) }))
    .sort((a, b) => a.date.getTime() - b.date.getTime());

  // Get total users
  const totalUsers = await prisma.user.count();
  
  // Get active users (users who joined a meeting in last 30 days)
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const activeUsers = await prisma.user.count({
    where: {
      meetings: {
        some: {
          joinedAt: {
            gte: thirtyDaysAgo,
          },
        },
      },
    },
  });

  // Calculate growth rate
  const firstPeriod = registrations[0]?.count || BigInt(0);
  const lastPeriod = registrations[registrations.length - 1]?.count || BigInt(0);
  const growthRate = firstPeriod > 0 
    ? Number((lastPeriod - firstPeriod) * BigInt(100) / firstPeriod) 
    : 0;

  res.json({
    period,
    dateRange: {
      start: defaultStartDate,
      end: defaultEndDate,
    },
    registrations: registrations.map(r => ({
      date: r.date,
      count: Number(r.count),
    })),
    summary: {
      totalUsers,
      activeUsers,
      inactiveUsers: totalUsers - activeUsers,
      growthRate: growthRate.toFixed(2),
    },
  });
}));

/**
 * GET /api/admin/analytics/meetings/stats
 * Get comprehensive meeting statistics
 */
router.get("/analytics/meetings/stats", asyncHandler(async (req: AdminRequest, res) => {
  const startDate = req.query.startDate ? new Date(req.query.startDate as string) : null;
  const endDate = req.query.endDate ? new Date(req.query.endDate as string) : null;

  const defaultEndDate = endDate || new Date();
  const defaultStartDate = startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const where: Prisma.MeetingWhereInput = {
    createdAt: {
      gte: defaultStartDate,
      lte: defaultEndDate,
    },
  };

  const [
    totalMeetings,
    meetingsWithParticipants,
    totalParticipants,
    meetingsWithMessages,
    totalMessages,
  ] = await Promise.all([
    prisma.meeting.count({ where }),
    prisma.meeting.count({
      where: {
        ...where,
        participants: {
          some: {},
        },
      },
    }),
    prisma.meetingParticipant.count({
      where: {
        meeting: where,
      },
    }),
    prisma.meeting.count({
      where: {
        ...where,
        chatMessages: {
          some: {},
        },
      },
    }),
    prisma.chatMessage.count({
      where: {
        meeting: where,
      },
    }),
  ]);

  // Calculate average meeting duration
  const meetingsWithDuration = await prisma.meeting.findMany({
    where,
    include: {
      participants: {
        select: {
          joinedAt: true,
          leftAt: true,
        },
      },
    },
  });

  const durations = meetingsWithDuration
    .map(meeting => {
      if (meeting.participants.length === 0) return null;
      const firstJoin = meeting.participants.reduce((earliest, p) => 
        p.joinedAt < earliest ? p.joinedAt : earliest, 
        meeting.participants[0]!.joinedAt
      );
      const lastLeave = meeting.participants
        .filter(p => p.leftAt)
        .reduce((latest, p) => 
          p.leftAt && p.leftAt > latest ? p.leftAt : latest, 
          firstJoin
        );
      return lastLeave ? lastLeave.getTime() - firstJoin.getTime() : null;
    })
    .filter((d): d is number => d !== null);

  const avgDuration = durations.length > 0
    ? Math.floor(durations.reduce((sum, d) => sum + d, 0) / durations.length / 1000)
    : 0;

  // Calculate average participants per meeting
  const avgParticipants = totalMeetings > 0 
    ? (totalParticipants / totalMeetings).toFixed(2)
    : "0";

  res.json({
    dateRange: {
      start: defaultStartDate,
      end: defaultEndDate,
    },
    meetings: {
      total: totalMeetings,
      withParticipants: meetingsWithParticipants,
      withMessages: meetingsWithMessages,
      averageDuration: avgDuration,
      averageDurationFormatted: formatDuration(avgDuration),
    },
    participants: {
      total: totalParticipants,
      averagePerMeeting: avgParticipants,
    },
    messages: {
      total: totalMessages,
      averagePerMeeting: totalMeetings > 0 ? (totalMessages / totalMeetings).toFixed(2) : "0",
    },
  });
}));

/**
 * GET /api/admin/analytics/usage/peak-times
 * Get peak usage times
 */
router.get("/analytics/usage/peak-times", asyncHandler(async (req: AdminRequest, res) => {
  // Get hourly distribution of meetings
  const allMeetings = await prisma.meeting.findMany({
    select: {
      createdAt: true,
    },
  });

  const hourlyMap = new Map<number, number>();
  allMeetings.forEach(meeting => {
    const hour = new Date(meeting.createdAt).getHours();
    hourlyMap.set(hour, (hourlyMap.get(hour) || 0) + 1);
  });
  const hourlyMeetings = Array.from({ length: 24 }, (_, hour) => ({
    hour,
    count: BigInt(hourlyMap.get(hour) || 0),
  }));

  // Get day of week distribution
  const dayOfWeekMap = new Map<number, number>();
  allMeetings.forEach(meeting => {
    const day = new Date(meeting.createdAt).getDay();
    dayOfWeekMap.set(day, (dayOfWeekMap.get(day) || 0) + 1);
  });
  const dayOfWeekMeetings = Array.from({ length: 7 }, (_, day) => ({
    day,
    count: BigInt(dayOfWeekMap.get(day) || 0),
  }));

  // Get concurrent users over time (last 24 hours)
  const last24Hours = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const participants = await prisma.meetingParticipant.findMany({
    where: {
      joinedAt: {
        gte: last24Hours,
      },
      OR: [
        { leftAt: null },
        { leftAt: { gte: last24Hours } },
      ],
    },
    select: {
      joinedAt: true,
      leftAt: true,
      userId: true,
    },
  });

  // Group by hour (simplified)
  const concurrentMap = new Map<string, Set<string>>();
  participants.forEach(p => {
    const hour = new Date(p.joinedAt).toISOString().slice(0, 13) + ':00:00.000Z';
    if (!concurrentMap.has(hour)) {
      concurrentMap.set(hour, new Set());
    }
    concurrentMap.get(hour)!.add(p.userId);
  });
  const concurrentData = Array.from(concurrentMap.entries()).map(([hour, users]) => ({
    hour: new Date(hour),
    active: BigInt(users.size),
  })).sort((a, b) => a.hour.getTime() - b.hour.getTime());

  // Get peak concurrent meetings (simplified - use total meetings created in peak hour)
  const peakConcurrentMeetings = hourlyMeetings
    .sort((a, b) => Number(b.count) - Number(a.count))
    .slice(0, 1)
    .map(h => ({
      hour: new Date(), // Simplified - would need actual hour calculation
      count: h.count,
    }));

  const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

  res.json({
    hourly: hourlyMeetings.map(h => ({
      hour: h.hour,
      count: Number(h.count),
    })),
    dayOfWeek: dayOfWeekMeetings.map(d => ({
      day: d.day,
      dayName: dayNames[d.day],
      count: Number(d.count),
    })),
    concurrent: {
      last24Hours: concurrentData.map(c => ({
        hour: c.hour,
        activeUsers: Number(c.active),
      })),
      peak: peakConcurrentMeetings.length > 0 ? {
        hour: peakConcurrentMeetings[0]!.hour,
        meetings: Number(peakConcurrentMeetings[0]!.count),
      } : null,
    },
  });
}));

/**
 * GET /api/admin/analytics/users/most-active
 * Get most active users
 */
router.get("/analytics/users/most-active", asyncHandler(async (req: AdminRequest, res) => {
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 10));
  const sortBy = (req.query.sortBy as string) || "meetings"; // meetings, messages, screenShares

  let orderBy: Prisma.UserOrderByWithRelationInput;
  
  switch (sortBy) {
    case "messages":
      orderBy = {
        chatMessages: {
          _count: "desc",
        },
      };
      break;
    case "screenShares":
      orderBy = {
        screenShares: {
          _count: "desc",
        },
      };
      break;
    default:
      orderBy = {
        meetings: {
          _count: "desc",
        },
      };
  }

  const users = await prisma.user.findMany({
    take: limit,
    orderBy,
    select: {
      id: true,
      name: true,
      email: true,
      createdAt: true,
      _count: {
        select: {
          meetings: true,
          chatMessages: true,
          screenShares: true,
          joinRequests: true,
        },
      },
    },
  });

  // Calculate activity scores
  const usersWithScores = users.map(user => ({
    ...user,
    activityScore: 
      user._count.meetings * 10 +
      user._count.chatMessages * 2 +
      user._count.screenShares * 5 +
      user._count.joinRequests * 1,
  })).sort((a, b) => b.activityScore - a.activityScore);

  res.json({
    sortBy,
    users: usersWithScores.map(user => ({
      id: user.id,
      name: user.name,
      email: user.email,
      createdAt: user.createdAt,
      stats: {
        meetings: user._count.meetings,
        messages: user._count.chatMessages,
        screenShares: user._count.screenShares,
        joinRequests: user._count.joinRequests,
      },
      activityScore: user.activityScore,
    })),
  });
}));

/**
 * GET /api/admin/analytics/meetings/popular
 * Get popular meeting rooms
 */
router.get("/analytics/meetings/popular", asyncHandler(async (req: AdminRequest, res) => {
  const sortBy = (req.query.sortBy as string) || "participants"; // participants, messages, duration
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 10));

  let orderBy: Prisma.MeetingOrderByWithRelationInput;
  
  switch (sortBy) {
    case "messages":
      orderBy = {
        chatMessages: {
          _count: "desc",
        },
      };
      break;
    case "duration":
      // This is complex, we'll sort by creation date for now
      orderBy = {
        createdAt: "desc",
      };
      break;
    default:
      orderBy = {
        participants: {
          _count: "desc",
        },
      };
  }

  const meetings = await prisma.meeting.findMany({
    take: limit,
    orderBy,
    include: {
      _count: {
        select: {
          participants: true,
          chatMessages: true,
          joinRequests: true,
        },
      },
      participants: {
        select: {
          joinedAt: true,
          leftAt: true,
        },
      },
    },
  });

  const meetingsWithStats = meetings.map(meeting => {
    const participants = meeting.participants;
    const firstJoin = participants.length > 0 && participants[0]
      ? participants.reduce((earliest, p) => 
          p.joinedAt < earliest ? p.joinedAt : earliest, 
          participants[0]!.joinedAt
        )
      : meeting.createdAt;
    const lastLeave = participants
      .filter(p => p.leftAt)
      .reduce((latest, p) => 
        p.leftAt && p.leftAt > latest ? p.leftAt : latest, 
        firstJoin
      );
    const duration = lastLeave 
      ? Math.floor((lastLeave.getTime() - firstJoin.getTime()) / 1000)
      : Math.floor((Date.now() - firstJoin.getTime()) / 1000);

    return {
      id: meeting.id,
      roomId: meeting.roomId,
      title: meeting.title,
      createdAt: meeting.createdAt,
      stats: {
        participants: meeting._count.participants,
        messages: meeting._count.chatMessages,
        joinRequests: meeting._count.joinRequests,
        duration: duration,
        durationFormatted: formatDuration(duration),
      },
    };
  });

  // Sort by duration if requested
  if (sortBy === "duration") {
    meetingsWithStats.sort((a, b) => b.stats.duration - a.stats.duration);
  }

  res.json({
    sortBy,
    meetings: meetingsWithStats,
  });
}));

/**
 * GET /api/admin/analytics/chat/stats
 * Get chat message statistics
 */
router.get("/analytics/chat/stats", asyncHandler(async (req: AdminRequest, res) => {
  const startDate = req.query.startDate ? new Date(req.query.startDate as string) : null;
  const endDate = req.query.endDate ? new Date(req.query.endDate as string) : null;

  const defaultEndDate = endDate || new Date();
  const defaultStartDate = startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const where: Prisma.ChatMessageWhereInput = {
    createdAt: {
      gte: defaultStartDate,
      lte: defaultEndDate,
    },
  };

  const [
    totalMessages,
    messagesByDay,
    topChatters,
  ] = await Promise.all([
    prisma.chatMessage.count({ where }),
    (async () => {
      const messages = await prisma.chatMessage.findMany({
        where: {
          createdAt: {
            gte: defaultStartDate,
            lte: defaultEndDate,
          },
        },
        select: {
          createdAt: true,
        },
      });
      const dailyMap = new Map<string, number>();
      messages.forEach(msg => {
      const date = new Date(msg.createdAt).toISOString().split('T')[0]!;
      dailyMap.set(date, (dailyMap.get(date) || 0) + 1);
      });
      return Array.from(dailyMap.entries()).map(([date, count]) => ({
        date: new Date(date),
        count: BigInt(count),
      })).sort((a, b) => a.date.getTime() - b.date.getTime());
    })(),
    prisma.user.findMany({
      take: 10,
      orderBy: {
        chatMessages: {
          _count: "desc",
        },
      },
      select: {
        id: true,
        name: true,
        email: true,
        _count: {
          select: {
            chatMessages: {
              where,
            },
          },
        },
      },
    }),
  ]);

  // Get average messages per meeting
  const meetingsWithMessages = await prisma.meeting.count({
    where: {
      chatMessages: {
        some: where,
      },
    },
  });

  const avgMessagesPerMeeting = meetingsWithMessages > 0
    ? (totalMessages / meetingsWithMessages).toFixed(2)
    : "0";

  res.json({
    dateRange: {
      start: defaultStartDate,
      end: defaultEndDate,
    },
    summary: {
      totalMessages,
      averagePerMeeting: avgMessagesPerMeeting,
      meetingsWithMessages,
    },
    daily: messagesByDay.map(m => ({
      date: m.date,
      count: Number(m.count),
    })),
    topChatters: topChatters.map(user => ({
      id: user.id,
      name: user.name,
      email: user.email,
      messageCount: user._count.chatMessages,
    })),
  });
}));

// ============================================================================
// PHASE 2: CONTENT MODERATION
// ============================================================================

/**
 * GET /api/admin/chat/messages
 * Get all chat messages with filtering
 */
router.get("/chat/messages", asyncHandler(async (req: AdminRequest, res) => {
  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
  const skip = (page - 1) * limit;
  const meetingId = req.query.meetingId as string | undefined;
  const userId = req.query.userId as string | undefined;
  const search = req.query.search as string | undefined;
  const startDate = req.query.startDate ? new Date(req.query.startDate as string) : null;
  const endDate = req.query.endDate ? new Date(req.query.endDate as string) : null;

  const where: Prisma.ChatMessageWhereInput = {};
  
  if (meetingId) where.meetingId = meetingId;
  if (userId) where.userId = userId;
  if (search) where.message = { contains: search, mode: "insensitive" };
  if (startDate || endDate) {
    where.createdAt = {};
    if (startDate) where.createdAt.gte = startDate;
    if (endDate) where.createdAt.lte = endDate;
  }

  const [messages, total] = await Promise.all([
    prisma.chatMessage.findMany({
      where,
      skip,
      take: limit,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        meeting: {
          select: {
            id: true,
            roomId: true,
            title: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    }),
    prisma.chatMessage.count({ where }),
  ]);

  res.json({
    data: messages,
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
 * DELETE /api/admin/chat/messages/:id
 * Delete a chat message
 */
router.delete("/chat/messages/:id", asyncHandler(async (req: AdminRequest, res) => {
  const { id } = req.params;
  
  if (!id) {
    return res.status(400).json({ error: "Message ID is required" });
  }

  const message = await prisma.chatMessage.findUnique({
    where: { id },
    include: {
      meeting: {
        select: {
          id: true,
          roomId: true,
        },
      },
      user: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });

  if (!message) {
    return res.status(404).json({ error: "Message not found" });
  }

  // Delete message
  await prisma.chatMessage.delete({
    where: { id },
  });

  // Notify meeting participants
  if (ioInstance) {
    ioInstance.to(message.meeting.roomId).emit("message-deleted", {
      messageId: id,
      deletedBy: req.admin?.userId,
      timestamp: new Date().toISOString(),
    });
  }

  await logAdminActivity(
    req.admin?.userId || "unknown",
    "message_deleted",
    "chat_message",
    id,
    { userId: message.userId, meetingId: message.meetingId, roomId: message.meeting.roomId },
    req.ip
  );

  logger.info(`Chat message deleted by admin`, { 
    messageId: id, 
    userId: message.userId,
    meetingId: message.meetingId,
    adminId: req.admin?.userId 
  });

  res.json({
    message: "Message deleted successfully",
  });
}));

// ============================================================================
// PHASE 2: SYSTEM HEALTH & MONITORING
// ============================================================================

/**
 * GET /api/admin/system/health
 * Get system health status
 */
router.get("/system/health", asyncHandler(async (req: AdminRequest, res) => {
  // Check database connection
  let dbStatus = "unknown";
  let dbLatency = 0;
  try {
    const start = Date.now();
    await prisma.user.findFirst({ take: 1 });
    dbLatency = Date.now() - start;
    dbStatus = "healthy";
  } catch (error) {
    dbStatus = "unhealthy";
    logger.error("Database health check failed", { error });
  }

  // Get socket.io status
  const socketStatus = ioInstance ? "connected" : "disconnected";
  const activeConnections = ioInstance ? ioInstance.sockets.sockets.size : 0;

  // Get memory usage
  const memoryUsage = process.memoryUsage();
  const memoryMB = {
    rss: Math.round(memoryUsage.rss / 1024 / 1024),
    heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024),
    heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024),
    external: Math.round(memoryUsage.external / 1024 / 1024),
  };

  // Get uptime
  const uptime = process.uptime();

  res.json({
    status: dbStatus === "healthy" && socketStatus === "connected" ? "healthy" : "degraded",
    timestamp: new Date().toISOString(),
    database: {
      status: dbStatus,
      latency: `${dbLatency}ms`,
    },
    socketio: {
      status: socketStatus,
      activeConnections,
      activeRooms: Object.keys(rooms).length,
    },
    memory: memoryMB,
    uptime: {
      seconds: Math.floor(uptime),
      formatted: formatUptime(uptime),
    },
  });
}));

/**
 * GET /api/admin/system/status
 * Get detailed server status
 */
router.get("/system/status", asyncHandler(async (req: AdminRequest, res) => {
  const nodeVersion = process.version;
  const platform = process.platform;
  const arch = process.arch;
  const env = process.env.NODE_ENV || "development";
  
  // Get connection stats
  const totalConnections = Object.keys(socketConnections).length;
  const activeRooms = Object.keys(rooms).length;

  // Get database stats
  const [totalUsers, totalMeetings, activeMeetings] = await Promise.all([
    prisma.user.count(),
    prisma.meeting.count(),
    prisma.meetingParticipant.count({
      where: { leftAt: null },
    }),
  ]);

  res.json({
    server: {
      nodeVersion,
      platform,
      arch,
      environment: env,
      startTime: new Date(Date.now() - process.uptime() * 1000),
      uptime: formatUptime(process.uptime()),
    },
    connections: {
      total: totalConnections,
      activeRooms,
    },
    database: {
      totalUsers,
      totalMeetings,
      activeMeetings,
    },
  });
}));

/**
 * Helper function to format uptime
 */
function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  
  if (days > 0) {
    return `${days}d ${hours}h ${minutes}m ${secs}s`;
  } else if (hours > 0) {
    return `${hours}h ${minutes}m ${secs}s`;
  } else if (minutes > 0) {
    return `${minutes}m ${secs}s`;
  } else {
    return `${secs}s`;
  }
}

// ============================================================================
// PHASE 2: USER SUSPENSION
// ============================================================================

/**
 * PATCH /api/admin/users/:id/suspend
 * Suspend a user
 */
router.patch("/users/:id/suspend", asyncHandler(async (req: AdminRequest, res) => {
  const { id } = req.params;
  const { reason } = req.body;
  
  if (!id) {
    return res.status(400).json({ error: "User ID is required" });
  }

  const user = await prisma.user.findUnique({
    where: { id },
  });

  if (!user) {
    return res.status(404).json({ error: "User not found" });
  }

  if (user.isAdmin) {
    return res.status(400).json({ error: "Cannot suspend an admin user" });
  }

  if (user.suspended) {
    return res.status(400).json({ error: "User is already suspended" });
  }

  // Disconnect all user's socket connections
  if (ioInstance) {
    const userSockets = Object.entries(socketConnections)
      .filter(([_, conn]) => conn.userId === id)
      .map(([socketId]) => socketId);

    for (const socketId of userSockets) {
      const socket = ioInstance.sockets.sockets.get(socketId);
      if (socket) {
        socket.emit("account-suspended", {
          reason: reason || "Your account has been suspended by an administrator",
        });
        cleanupMediaSoupResources(socketId);
        socket.disconnect(true);
      }
      delete socketConnections[socketId];
    }
  }

  // Update user
  const updatedUser = await prisma.user.update({
    where: { id },
    data: {
      suspended: true,
      suspendedAt: new Date(),
      suspendedBy: req.admin?.userId || null,
      suspensionReason: reason || null,
    },
  });

  // Emit admin event
  if (ioInstance) {
    const adminNamespace = getAdminNamespace(ioInstance);
    if (adminNamespace) {
      adminNamespace.emit("user-suspended", {
        userId: id,
        userName: user.name,
        reason: reason || null,
        suspendedBy: req.admin?.userId,
        timestamp: new Date().toISOString(),
      });
    }
  }

  await logAdminActivity(
    req.admin?.userId || "unknown",
    "user_suspended",
    "user",
    id,
    { reason: reason || "No reason provided" },
    req.ip
  );

  logger.info(`User suspended by admin`, { 
    userId: id, 
    reason: reason || "No reason provided",
    adminId: req.admin?.userId 
  });

  res.json({
    message: "User suspended successfully",
    user: updatedUser,
  });
}));

/**
 * PATCH /api/admin/users/:id/unsuspend
 * Unsuspend a user
 */
router.patch("/users/:id/unsuspend", asyncHandler(async (req: AdminRequest, res) => {
  const { id } = req.params;
  
  if (!id) {
    return res.status(400).json({ error: "User ID is required" });
  }

  const user = await prisma.user.findUnique({
    where: { id },
  });

  if (!user) {
    return res.status(404).json({ error: "User not found" });
  }

  if (!user.suspended) {
    return res.status(400).json({ error: "User is not suspended" });
  }

  // Update user
  const updatedUser = await prisma.user.update({
    where: { id },
    data: {
      suspended: false,
      suspendedAt: null,
      suspendedBy: null,
      suspensionReason: null,
    },
  });

  // Emit admin event
  if (ioInstance) {
    const adminNamespace = getAdminNamespace(ioInstance);
    if (adminNamespace) {
      adminNamespace.emit("user-unsuspended", {
        userId: id,
        userName: user.name,
        unsuspendedBy: req.admin?.userId,
        timestamp: new Date().toISOString(),
      });
    }
  }

  await logAdminActivity(
    req.admin?.userId || "unknown",
    "user_unsuspended",
    "user",
    id,
    null,
    req.ip
  );

  logger.info(`User unsuspended by admin`, { 
    userId: id,
    adminId: req.admin?.userId 
  });

  res.json({
    message: "User unsuspended successfully",
    user: updatedUser,
  });
}));

// ============================================================================
// PHASE 3: ADMIN ACTIVITY LOG
// ============================================================================

/**
 * GET /api/admin/activity-logs
 * Get admin activity logs
 */
router.get("/activity-logs", asyncHandler(async (req: AdminRequest, res) => {
  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
  const skip = (page - 1) * limit;
  const adminId = req.query.adminId as string | undefined;
  const action = req.query.action as string | undefined;
  const startDate = req.query.startDate ? new Date(req.query.startDate as string) : null;
  const endDate = req.query.endDate ? new Date(req.query.endDate as string) : null;

  const where: Prisma.AdminActivityLogWhereInput = {};
  
  if (adminId) where.adminId = adminId;
  if (action) where.action = { contains: action, mode: "insensitive" };
  if (startDate || endDate) {
    where.createdAt = {};
    if (startDate) where.createdAt.gte = startDate;
    if (endDate) where.createdAt.lte = endDate;
  }

  const [logs, total] = await Promise.all([
    prisma.adminActivityLog.findMany({
      where,
      skip,
      take: limit,
      orderBy: {
        createdAt: "desc",
      },
    }),
    prisma.adminActivityLog.count({ where }),
  ]);

  res.json({
    data: logs.map(log => ({
      ...log,
      details: log.details ? JSON.parse(log.details) : null,
    })),
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

// ============================================================================
// PHASE 3: SECURITY FEATURES
// ============================================================================

/**
 * GET /api/admin/security/login-attempts
 * Get login attempts
 */
router.get("/security/login-attempts", asyncHandler(async (req: AdminRequest, res) => {
  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
  const skip = (page - 1) * limit;
  const email = req.query.email as string | undefined;
  const ipAddress = req.query.ipAddress as string | undefined;
  const success = req.query.success === "true" ? true : req.query.success === "false" ? false : undefined;
  const startDate = req.query.startDate ? new Date(req.query.startDate as string) : null;
  const endDate = req.query.endDate ? new Date(req.query.endDate as string) : null;

  const where: Prisma.LoginAttemptWhereInput = {};
  
  if (email) where.email = { contains: email, mode: "insensitive" };
  if (ipAddress) where.ipAddress = ipAddress;
  if (success !== undefined) where.success = success;
  if (startDate || endDate) {
    where.createdAt = {};
    if (startDate) where.createdAt.gte = startDate;
    if (endDate) where.createdAt.lte = endDate;
  }

  const [attempts, total] = await Promise.all([
    prisma.loginAttempt.findMany({
      where,
      skip,
      take: limit,
      orderBy: {
        createdAt: "desc",
      },
    }),
    prisma.loginAttempt.count({ where }),
  ]);

  // Get statistics
  const [totalAttempts, failedAttempts, successfulAttempts] = await Promise.all([
    prisma.loginAttempt.count(),
    prisma.loginAttempt.count({ where: { success: false } }),
    prisma.loginAttempt.count({ where: { success: true } }),
  ]);

  res.json({
    data: attempts,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      hasNext: page * limit < total,
      hasPrev: page > 1,
    },
    statistics: {
      totalAttempts,
      failedAttempts,
      successfulAttempts,
      failureRate: totalAttempts > 0 ? ((failedAttempts / totalAttempts) * 100).toFixed(2) : "0",
    },
  });
}));

/**
 * POST /api/admin/security/block-ip
 * Block an IP address
 */
router.post("/security/block-ip", asyncHandler(async (req: AdminRequest, res) => {
  const { ipAddress, reason, expiresAt } = req.body;
  
  if (!ipAddress) {
    return res.status(400).json({ error: "IP address is required" });
  }

  // Check if already blocked
  const existing = await prisma.blockedIP.findUnique({
    where: { ipAddress },
  });

  if (existing) {
    return res.status(409).json({ error: "IP address is already blocked" });
  }

  const blockedIP = await prisma.blockedIP.create({
    data: {
      ipAddress,
      reason: reason || null,
      expiresAt: expiresAt ? new Date(expiresAt) : null,
      blockedBy: req.admin?.userId || null,
    },
  });

  await logAdminActivity(
    req.admin?.userId || "unknown",
    "ip_blocked",
    "ip",
    ipAddress,
    { reason, expiresAt },
    req.ip
  );

  logger.info(`IP blocked by admin`, { 
    ipAddress, 
    reason: reason || "No reason provided",
    adminId: req.admin?.userId 
  });

  res.json({
    message: "IP address blocked successfully",
    blockedIP,
  });
}));

/**
 * DELETE /api/admin/security/block-ip/:ip
 * Unblock an IP address
 */
router.delete("/security/block-ip/:ip", asyncHandler(async (req: AdminRequest, res) => {
  const ipParam = req.params.ip;
  
  if (!ipParam) {
    return res.status(400).json({ error: "IP address is required" });
  }
  
  const ip = decodeURIComponent(ipParam);

  const blockedIP = await prisma.blockedIP.findUnique({
    where: { ipAddress: ip },
  });

  if (!blockedIP) {
    return res.status(404).json({ error: "IP address is not blocked" });
  }

  await prisma.blockedIP.delete({
    where: { ipAddress: ip },
  });

  await logAdminActivity(
    req.admin?.userId || "unknown",
    "ip_unblocked",
    "ip",
    ip,
    null,
    req.ip
  );

  logger.info(`IP unblocked by admin`, { 
    ipAddress: ip,
    adminId: req.admin?.userId 
  });

  res.json({
    message: "IP address unblocked successfully",
  });
}));

/**
 * GET /api/admin/security/blocked-ips
 * Get all blocked IPs
 */
router.get("/security/blocked-ips", asyncHandler(async (req: AdminRequest, res) => {
  const blockedIPs = await prisma.blockedIP.findMany({
    orderBy: {
      createdAt: "desc",
    },
  });

  // Filter out expired IPs
  const now = new Date();
  const active = blockedIPs.filter(ip => !ip.expiresAt || ip.expiresAt > now);
  const expired = blockedIPs.filter(ip => ip.expiresAt && ip.expiresAt <= now);

  res.json({
    active,
    expired,
    total: blockedIPs.length,
  });
}));

/**
 * GET /api/admin/security/audit-log
 * Get security audit log
 */
router.get("/security/audit-log", asyncHandler(async (req: AdminRequest, res) => {
  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
  const skip = (page - 1) * limit;

  // Get security-related activities
  const securityActions = [
    "ip_blocked",
    "ip_unblocked",
    "user_suspended",
    "user_unsuspended",
    "user_deleted",
    "login_failed",
  ];

  const where: Prisma.AdminActivityLogWhereInput = {
    action: {
      in: securityActions,
    },
  };

  const [logs, total] = await Promise.all([
    prisma.adminActivityLog.findMany({
      where,
      skip,
      take: limit,
      orderBy: {
        createdAt: "desc",
      },
    }),
    prisma.adminActivityLog.count({ where }),
  ]);

  res.json({
    data: logs.map(log => ({
      ...log,
      details: log.details ? JSON.parse(log.details) : null,
    })),
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

// ============================================================================
// PHASE 3: NOTIFICATIONS & ANNOUNCEMENTS
// ============================================================================

/**
 * POST /api/admin/notifications/announcement
 * Create a system announcement
 */
router.post("/notifications/announcement", asyncHandler(async (req: AdminRequest, res) => {
  const { title, message, targetType, targetUserIds, expiresAt } = req.body;
  
  if (!title || !message) {
    return res.status(400).json({ error: "Title and message are required" });
  }

  const announcement = await prisma.announcement.create({
    data: {
      title,
      message,
      targetType: targetType || "all",
      targetUserIds: targetUserIds ? JSON.stringify(targetUserIds) : null,
      createdBy: req.admin?.userId || "unknown",
      expiresAt: expiresAt ? new Date(expiresAt) : null,
      isActive: true,
    },
  });

  // Broadcast to all connected users
  if (ioInstance) {
    if (targetType === "all") {
      ioInstance.emit("announcement", {
        id: announcement.id,
        title: announcement.title,
        message: announcement.message,
        createdAt: announcement.createdAt,
      });
    } else if (targetUserIds && Array.isArray(targetUserIds)) {
      // Send to specific users
      targetUserIds.forEach((userId: string) => {
        const userSockets = Object.entries(socketConnections)
          .filter(([_, conn]) => conn.userId === userId)
          .map(([socketId]) => socketId);

        userSockets.forEach(socketId => {
          const socket = ioInstance!.sockets.sockets.get(socketId);
          if (socket) {
            socket.emit("announcement", {
              id: announcement.id,
              title: announcement.title,
              message: announcement.message,
              createdAt: announcement.createdAt,
            });
          }
        });
      });
    }
  }

  await logAdminActivity(
    req.admin?.userId || "unknown",
    "announcement_created",
    "announcement",
    announcement.id,
    { title, targetType },
    req.ip
  );

  logger.info(`Announcement created by admin`, { 
    announcementId: announcement.id,
    adminId: req.admin?.userId 
  });

  res.json({
    message: "Announcement created and broadcast successfully",
    announcement,
  });
}));

/**
 * GET /api/admin/notifications/announcements
 * Get all announcements
 */
router.get("/notifications/announcements", asyncHandler(async (req: AdminRequest, res) => {
  const active = req.query.active === "true" ? true : req.query.active === "false" ? false : undefined;

  const where: Prisma.AnnouncementWhereInput = {};
  if (active !== undefined) {
    where.isActive = active;
    if (active) {
      where.OR = [
        { expiresAt: null },
        { expiresAt: { gt: new Date() } },
      ];
    }
  }

  const announcements = await prisma.announcement.findMany({
    where,
    orderBy: {
      createdAt: "desc",
    },
  });

  res.json({
    data: announcements.map(announcement => ({
      ...announcement,
      targetUserIds: announcement.targetUserIds ? JSON.parse(announcement.targetUserIds) : null,
    })),
  });
}));

/**
 * PATCH /api/admin/notifications/announcements/:id
 * Update an announcement
 */
router.patch("/notifications/announcements/:id", asyncHandler(async (req: AdminRequest, res) => {
  const { id } = req.params;
  const { title, message, isActive, expiresAt } = req.body;
  
  if (!id) {
    return res.status(400).json({ error: "Announcement ID is required" });
  }

  const announcement = await prisma.announcement.findUnique({
    where: { id },
  });

  if (!announcement) {
    return res.status(404).json({ error: "Announcement not found" });
  }

  const updateData: Prisma.AnnouncementUpdateInput = {};
  if (title !== undefined) updateData.title = title;
  if (message !== undefined) updateData.message = message;
  if (isActive !== undefined) updateData.isActive = isActive;
  if (expiresAt !== undefined) updateData.expiresAt = expiresAt ? new Date(expiresAt) : null;

  const updatedAnnouncement = await prisma.announcement.update({
    where: { id },
    data: updateData,
  });

  await logAdminActivity(
    req.admin?.userId || "unknown",
    "announcement_updated",
    "announcement",
    id,
    updateData,
    req.ip
  );

  res.json({
    message: "Announcement updated successfully",
    announcement: updatedAnnouncement,
  });
}));

/**
 * DELETE /api/admin/notifications/announcements/:id
 * Delete an announcement
 */
router.delete("/notifications/announcements/:id", asyncHandler(async (req: AdminRequest, res) => {
  const { id } = req.params;
  
  if (!id) {
    return res.status(400).json({ error: "Announcement ID is required" });
  }

  const announcement = await prisma.announcement.findUnique({
    where: { id },
  });

  if (!announcement) {
    return res.status(404).json({ error: "Announcement not found" });
  }

  await prisma.announcement.delete({
    where: { id },
  });

  await logAdminActivity(
    req.admin?.userId || "unknown",
    "announcement_deleted",
    "announcement",
    id,
    null,
    req.ip
  );

  res.json({
    message: "Announcement deleted successfully",
  });
}));

// ============================================================================
// PHASE 3: SETTINGS & CONFIGURATION
// ============================================================================

/**
 * GET /api/admin/settings
 * Get all system settings
 */
router.get("/settings", asyncHandler(async (req: AdminRequest, res) => {
  const settings = await prisma.systemSettings.findMany({
    orderBy: {
      key: "asc",
    },
  });

  const settingsMap: Record<string, any> = {};
  settings.forEach(setting => {
    try {
      settingsMap[setting.key] = JSON.parse(setting.value);
    } catch {
      settingsMap[setting.key] = setting.value;
    }
  });

  res.json({
    settings: settingsMap,
    raw: settings,
  });
}));

/**
 * GET /api/admin/settings/:key
 * Get a specific setting
 */
router.get("/settings/:key", asyncHandler(async (req: AdminRequest, res) => {
  const { key } = req.params;
  
  if (!key) {
    return res.status(400).json({ error: "Setting key is required" });
  }
  
  const setting = await prisma.systemSettings.findUnique({
    where: { key },
  });

  if (!setting) {
    return res.status(404).json({ error: "Setting not found" });
  }

  let value: any;
  try {
    value = JSON.parse(setting.value);
  } catch {
    value = setting.value;
  }

  res.json({
    key: setting.key,
    value,
    updatedAt: setting.updatedAt,
    updatedBy: setting.updatedBy,
  });
}));

/**
 * PATCH /api/admin/settings/:key
 * Update a system setting
 */
router.patch("/settings/:key", asyncHandler(async (req: AdminRequest, res) => {
  const { key } = req.params;
  const { value } = req.body;
  
  if (!key) {
    return res.status(400).json({ error: "Setting key is required" });
  }
  
  if (value === undefined) {
    return res.status(400).json({ error: "Value is required" });
  }

  const valueString = typeof value === "string" ? value : JSON.stringify(value);

  const setting = await prisma.systemSettings.upsert({
    where: { key },
    update: {
      value: valueString,
      updatedBy: req.admin?.userId || null,
    },
    create: {
      key,
      value: valueString,
      updatedBy: req.admin?.userId || null,
    },
  });

  await logAdminActivity(
    req.admin?.userId || "unknown",
    "setting_updated",
    "setting",
    key,
    { value },
    req.ip
  );

  let parsedValue: any;
  try {
    parsedValue = JSON.parse(setting.value);
  } catch {
    parsedValue = setting.value;
  }

  res.json({
    message: "Setting updated successfully",
    setting: {
      key: setting.key,
      value: parsedValue,
      updatedAt: setting.updatedAt,
      updatedBy: setting.updatedBy,
    },
  });
}));

// ============================================================================
// PHASE 3: BACKUP & MAINTENANCE
// ============================================================================

/**
 * GET /api/admin/maintenance/export
 * Export data for backup
 */
router.get("/maintenance/export", asyncHandler(async (req: AdminRequest, res) => {
  const type = (req.query.type as string) || "all"; // all, users, meetings, messages
  const format = (req.query.format as string) || "json"; // json, csv
  const startDate = req.query.startDate ? new Date(req.query.startDate as string) : null;
  const endDate = req.query.endDate ? new Date(req.query.endDate as string) : null;

  const dateFilter = startDate || endDate ? {
    createdAt: {
      ...(startDate && { gte: startDate }),
      ...(endDate && { lte: endDate }),
    },
  } : {};

  let data: any = {};

  if (type === "all" || type === "users") {
    const users = await prisma.user.findMany({
      where: dateFilter,
      select: {
        id: true,
        name: true,
        email: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    data.users = users;
  }

  if (type === "all" || type === "meetings") {
    const meetings = await prisma.meeting.findMany({
      where: dateFilter,
      include: {
        _count: {
          select: {
            participants: true,
            chatMessages: true,
          },
        },
      },
    });
    data.meetings = meetings;
  }

  if (type === "all" || type === "messages") {
    const messages = await prisma.chatMessage.findMany({
      where: dateFilter,
      take: 10000, // Limit to prevent huge exports
      include: {
        user: {
          select: {
            id: true,
            name: true,
          },
        },
        meeting: {
          select: {
            id: true,
            roomId: true,
          },
        },
      },
    });
    data.messages = messages;
  }

  await logAdminActivity(
    req.admin?.userId || "unknown",
    "data_exported",
    "export",
    type,
    { format, type, dateRange: { startDate, endDate } },
    req.ip
  );

  if (format === "csv") {
    // Simple CSV conversion (basic implementation)
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename="export-${type}-${Date.now()}.csv"`);
    
    // For now, return JSON as CSV is complex for nested data
    res.json({
      message: "CSV export not fully implemented for nested data. Use JSON format.",
      data,
    });
  } else {
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Content-Disposition", `attachment; filename="export-${type}-${Date.now()}.json"`);
    res.json(data);
  }
}));

/**
 * POST /api/admin/maintenance/cleanup
 * Cleanup old data
 */
router.post("/maintenance/cleanup", asyncHandler(async (req: AdminRequest, res) => {
  const { 
    deleteOldMeetings, 
    deleteOldMessages, 
    meetingRetentionDays, 
    messageRetentionDays 
  } = req.body;

  const results: any = {
    meetingsDeleted: 0,
    messagesDeleted: 0,
  };

  if (deleteOldMeetings && meetingRetentionDays) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - meetingRetentionDays);

    const oldMeetings = await prisma.meeting.findMany({
      where: {
        createdAt: {
          lt: cutoffDate,
        },
        participants: {
          none: {
            leftAt: null, // No active participants
          },
        },
      },
      select: {
        id: true,
      },
    });

    for (const meeting of oldMeetings) {
      await prisma.meeting.delete({
        where: { id: meeting.id },
      });
      results.meetingsDeleted++;
    }
  }

  if (deleteOldMessages && messageRetentionDays) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - messageRetentionDays);

    const deleteResult = await prisma.chatMessage.deleteMany({
      where: {
        createdAt: {
          lt: cutoffDate,
        },
      },
    });

    results.messagesDeleted = deleteResult.count;
  }

  await logAdminActivity(
    req.admin?.userId || "unknown",
    "data_cleanup",
    "maintenance",
    undefined,
    results,
    req.ip
  );

  logger.info(`Data cleanup performed by admin`, { 
    results,
    adminId: req.admin?.userId 
  });

  res.json({
    message: "Cleanup completed successfully",
    results,
  });
}));

// ============================================================================
// ADDITIONAL FEATURES: UPDATE MEETING SETTINGS, ERROR LOGS, NOTIFY USER, FLAG USER
// ============================================================================

/**
 * PATCH /api/admin/meetings/:id/settings
 * Update meeting settings
 */
router.patch("/meetings/:id/settings", asyncHandler(async (req: AdminRequest, res) => {
  const { id } = req.params;
  const { title, requiresApproval } = req.body;
  
  if (!id) {
    return res.status(400).json({ error: "Meeting ID is required" });
  }

  const meeting = await prisma.meeting.findUnique({
    where: { id },
  });

  if (!meeting) {
    return res.status(404).json({ error: "Meeting not found" });
  }

  const updateData: Prisma.MeetingUpdateInput = {};
  if (title !== undefined) updateData.title = title;
  if (requiresApproval !== undefined) updateData.requiresApproval = requiresApproval;

  const updatedMeeting = await prisma.meeting.update({
    where: { id },
    data: updateData,
  });

  // Notify meeting participants about settings change
  if (ioInstance) {
    ioInstance.to(meeting.roomId).emit("meeting-settings-updated", {
      meetingId: id,
      roomId: meeting.roomId,
      title: updatedMeeting.title,
      requiresApproval: updatedMeeting.requiresApproval,
      updatedBy: req.admin?.userId,
    });
  }

  await logAdminActivity(
    req.admin?.userId || "unknown",
    "meeting_settings_updated",
    "meeting",
    id,
    updateData,
    req.ip
  );

  logger.info(`Meeting settings updated by admin`, { 
    meetingId: id, 
    roomId: meeting.roomId,
    updates: Object.keys(updateData),
    adminId: req.admin?.userId 
  });

  res.json({
    message: "Meeting settings updated successfully",
    meeting: updatedMeeting,
  });
}));

/**
 * GET /api/admin/system/logs/errors
 * Get error logs
 */
router.get("/system/logs/errors", asyncHandler(async (req: AdminRequest, res) => {
  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 50));
  const skip = (page - 1) * limit;
  const search = req.query.search as string | undefined;
  const startDate = req.query.startDate ? new Date(req.query.startDate as string) : null;
  const endDate = req.query.endDate ? new Date(req.query.endDate as string) : null;

  // Get error logs from admin activity logs (filter for errors)
  const where: Prisma.AdminActivityLogWhereInput = {
    action: {
      contains: "error",
      mode: "insensitive",
    },
  };

  // Also get from login attempts (failed logins)
  const loginAttemptsWhere: Prisma.LoginAttemptWhereInput = {
    success: false,
  };

  if (startDate || endDate) {
    const dateFilter: any = {};
    if (startDate) dateFilter.gte = startDate;
    if (endDate) dateFilter.lte = endDate;
    
    where.createdAt = dateFilter;
    loginAttemptsWhere.createdAt = dateFilter;
  }

  // Get error activity logs
  const [errorLogs, errorLogsTotal] = await Promise.all([
    prisma.adminActivityLog.findMany({
      where,
      skip,
      take: limit,
      orderBy: {
        createdAt: "desc",
      },
    }),
    prisma.adminActivityLog.count({ where }),
  ]);

  // Get failed login attempts
  const [failedLogins, failedLoginsTotal] = await Promise.all([
    prisma.loginAttempt.findMany({
      where: loginAttemptsWhere,
      skip,
      take: limit,
      orderBy: {
        createdAt: "desc",
      },
    }),
    prisma.loginAttempt.count({ where: loginAttemptsWhere }),
  ]);

  // Combine and format logs
  const combinedLogs = [
    ...errorLogs.map(log => ({
      type: "activity",
      id: log.id,
      severity: "error",
      message: log.action,
      details: log.details ? JSON.parse(log.details) : null,
      timestamp: log.createdAt,
      ipAddress: log.ipAddress,
      adminId: log.adminId,
    })),
    ...failedLogins.map(attempt => ({
      type: "login_attempt",
      id: attempt.id,
      severity: "error",
      message: "Failed login attempt",
      details: {
        email: attempt.email,
        ipAddress: attempt.ipAddress,
        userAgent: attempt.userAgent,
      },
      timestamp: attempt.createdAt,
      ipAddress: attempt.ipAddress,
    })),
  ]
    .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
    .slice(0, limit);

  // Filter by search if provided
  const filteredLogs = search
    ? combinedLogs.filter(log => 
        log.message.toLowerCase().includes(search.toLowerCase()) ||
        (log.details && JSON.stringify(log.details).toLowerCase().includes(search.toLowerCase()))
      )
    : combinedLogs;

  res.json({
    data: filteredLogs,
    pagination: {
      page,
      limit,
      total: errorLogsTotal + failedLoginsTotal,
      totalPages: Math.ceil((errorLogsTotal + failedLoginsTotal) / limit),
      hasNext: page * limit < (errorLogsTotal + failedLoginsTotal),
      hasPrev: page > 1,
    },
    statistics: {
      totalErrors: errorLogsTotal + failedLoginsTotal,
      activityErrors: errorLogsTotal,
      failedLogins: failedLoginsTotal,
    },
  });
}));

/**
 * POST /api/admin/notifications/user/:id
 * Send notification to specific user
 */
router.post("/notifications/user/:id", asyncHandler(async (req: AdminRequest, res) => {
  const { id } = req.params;
  const { title, message, type } = req.body; // type: info, warning, error
  
  if (!id) {
    return res.status(400).json({ error: "User ID is required" });
  }

  if (!title || !message) {
    return res.status(400).json({ error: "Title and message are required" });
  }

  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      email: true,
    },
  });

  if (!user) {
    return res.status(404).json({ error: "User not found" });
  }

  // Send notification via socket if user is connected
  if (ioInstance) {
    const userSockets = Object.entries(socketConnections)
      .filter(([_, conn]) => conn.userId === id)
      .map(([socketId]) => socketId);

    for (const socketId of userSockets) {
      const socket = ioInstance.sockets.sockets.get(socketId);
      if (socket) {
        socket.emit("admin-notification", {
          id: `admin-${Date.now()}`,
          title,
          message,
          type: type || "info",
          from: "admin",
          timestamp: new Date().toISOString(),
        });
      }
    }
  }

  await logAdminActivity(
    req.admin?.userId || "unknown",
    "user_notified",
    "user",
    id,
    { title, message, type: type || "info", userName: user.name },
    req.ip
  );

  logger.info(`User notified by admin`, { 
    userId: id,
    userName: user.name,
    adminId: req.admin?.userId 
  });

  res.json({
    message: "Notification sent successfully",
    notification: {
      userId: id,
      userName: user.name,
      title,
      message,
      type: type || "info",
      sentAt: new Date().toISOString(),
    },
  });
}));

/**
 * POST /api/admin/users/:id/flag
 * Flag a user for review
 */
router.post("/users/:id/flag", asyncHandler(async (req: AdminRequest, res) => {
  const { id } = req.params;
  const { reason } = req.body;
  
  if (!id) {
    return res.status(400).json({ error: "User ID is required" });
  }

  const user = await prisma.user.findUnique({
    where: { id },
  });

  if (!user) {
    return res.status(404).json({ error: "User not found" });
  }

  if (user.isAdmin) {
    return res.status(400).json({ error: "Cannot flag an admin user" });
  }

  if (user.flagged) {
    return res.status(400).json({ error: "User is already flagged" });
  }

  const updatedUser = await prisma.user.update({
    where: { id },
    data: {
      flagged: true,
      flaggedAt: new Date(),
      flaggedBy: req.admin?.userId || null,
      flagReason: reason || null,
    },
  });

  // Emit admin event
  if (ioInstance) {
    const adminNamespace = getAdminNamespace(ioInstance);
    if (adminNamespace) {
      adminNamespace.emit("user-flagged", {
        userId: id,
        userName: user.name,
        reason: reason || null,
        flaggedBy: req.admin?.userId,
        timestamp: new Date().toISOString(),
      });
    }
  }

  await logAdminActivity(
    req.admin?.userId || "unknown",
    "user_flagged",
    "user",
    id,
    { reason: reason || "No reason provided", userName: user.name },
    req.ip
  );

  logger.info(`User flagged by admin`, { 
    userId: id,
    reason: reason || "No reason provided",
    adminId: req.admin?.userId 
  });

  res.json({
    message: "User flagged successfully",
    user: updatedUser,
  });
}));

/**
 * POST /api/admin/users/:id/unflag
 * Unflag a user
 */
router.post("/users/:id/unflag", asyncHandler(async (req: AdminRequest, res) => {
  const { id } = req.params;
  
  if (!id) {
    return res.status(400).json({ error: "User ID is required" });
  }

  const user = await prisma.user.findUnique({
    where: { id },
  });

  if (!user) {
    return res.status(404).json({ error: "User not found" });
  }

  if (!user.flagged) {
    return res.status(400).json({ error: "User is not flagged" });
  }

  const updatedUser = await prisma.user.update({
    where: { id },
    data: {
      flagged: false,
      flaggedAt: null,
      flaggedBy: null,
      flagReason: null,
    },
  });

  await logAdminActivity(
    req.admin?.userId || "unknown",
    "user_unflagged",
    "user",
    id,
    { userName: user.name },
    req.ip
  );

  logger.info(`User unflagged by admin`, { 
    userId: id,
    adminId: req.admin?.userId 
  });

  res.json({
    message: "User unflagged successfully",
    user: updatedUser,
  });
}));

/**
 * GET /api/admin/moderation/queue
 * Get moderation queue (flagged users and content)
 */
router.get("/moderation/queue", asyncHandler(async (req: AdminRequest, res) => {
  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
  const skip = (page - 1) * limit;
  const type = req.query.type as string | undefined; // users, messages, all

  let flaggedUsers: any[] = [];
  if (type !== "messages") {
    const queryOptions: any = {
      where: {
        flagged: true,
      },
      select: {
        id: true,
        name: true,
        email: true,
        flaggedAt: true,
        flaggedBy: true,
        flagReason: true,
        createdAt: true,
        _count: {
          select: {
            chatMessages: true,
            meetings: true,
          },
        },
      },
      orderBy: {
        flaggedAt: "desc",
      },
    };

    if (type === "all") {
      queryOptions.skip = skip;
      queryOptions.take = limit;
    }

    flaggedUsers = await prisma.user.findMany(queryOptions);
  }

  // Note: For flagged messages, we'd need a separate flagging system
  // For now, we'll return flagged users only
  const flaggedMessages: any[] = [];

  const total = flaggedUsers.length;

  res.json({
    data: {
      users: flaggedUsers.map(user => ({
        id: user.id,
        name: user.name,
        email: user.email,
        flaggedAt: user.flaggedAt,
        flagReason: user.flagReason,
        flaggedBy: user.flaggedBy,
        createdAt: user.createdAt,
        stats: {
          messages: user._count.chatMessages,
          meetings: user._count.meetings,
        },
      })),
      messages: flaggedMessages,
    },
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      hasNext: page * limit < total,
      hasPrev: page > 1,
    },
    summary: {
      flaggedUsers: flaggedUsers.length,
      flaggedMessages: flaggedMessages.length,
      total: flaggedUsers.length + flaggedMessages.length,
    },
  });
}));

// ============================================================================
// MAIN ADMIN: ADMIN MANAGEMENT
// ============================================================================

/**
 * Helper to check if admin is main admin
 */
function requireMainAdmin(req: AdminRequest, res: Response): boolean {
  // Check both isMainAdmin flag and role
  const isMainAdmin = req.admin?.isMainAdmin === true || req.admin?.role === "MAIN_ADMIN";
  
  if (!isMainAdmin) {
    logger.warn("requireMainAdmin - Access denied", { 
      adminId: req.admin?.userId,
      isMainAdmin: req.admin?.isMainAdmin,
      role: req.admin?.role 
    });
    res.status(403).json({ error: "Main admin access required" });
    return false;
  }
  return true;
}

/**
 * GET /api/admin/admins
 * Get all admins except main admin (main admin only)
 */
router.get("/admins", asyncHandler(async (req: AdminRequest, res) => {
  logger.info("GET /api/admin/admins - Request received", { 
    adminId: req.admin?.userId,
    isMainAdmin: req.admin?.isMainAdmin,
    role: req.admin?.role 
  });
  
  if (!requireMainAdmin(req, res)) {
    logger.warn("GET /api/admin/admins - Main admin access required", { 
      adminId: req.admin?.userId,
      isMainAdmin: req.admin?.isMainAdmin,
      role: req.admin?.role 
    });
    return;
  }

  const admins = await prisma.admin.findMany({
    where: {
      NOT: {
        role: "MAIN_ADMIN", // Get all admins except main admin (includes SUPER_ADMIN, null, or any other role)
      },
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      isActive: true,
      createdBy: true,
      createdAt: true,
      updatedAt: true,
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  res.json({
    admins,
    total: admins.length,
    active: admins.filter(a => a.isActive).length,
    inactive: admins.filter(a => !a.isActive).length,
  });
}));

/**
 * POST /api/admin/admins
 * Create a new admin (main admin only)
 */
router.post("/admins", asyncHandler(async (req: AdminRequest, res) => {
  logger.info("POST /api/admin/admins - Request received", { 
    body: { name: req.body?.name, email: req.body?.email },
    adminId: req.admin?.userId,
    isMainAdmin: req.admin?.isMainAdmin 
  });
  
  if (!requireMainAdmin(req, res)) {
    logger.warn("POST /api/admin/admins - Main admin access required", { 
      adminId: req.admin?.userId,
      isMainAdmin: req.admin?.isMainAdmin 
    });
    return;
  }

  const { name, email, password } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ error: "Name, email, and password are required" });
  }

  // Check if admin already exists
  const existing = await prisma.admin.findUnique({
    where: { email },
  });

  if (existing) {
    return res.status(409).json({ error: "Admin with this email already exists" });
  }

  // Hash password
  const { hashPassword } = await import("../../utils/auth.js");
  const hashedPassword = await hashPassword(password);

  // Create admin
  const newAdmin = await prisma.admin.create({
    data: {
      name,
      email,
      password: hashedPassword,
      role: "SUPER_ADMIN", // Default role for new admins
      isActive: true,
      createdBy: req.admin?.userId || null,
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      isActive: true,
      createdAt: true,
    },
  });

  await logAdminActivity(
    req.admin?.userId || "unknown",
    "admin_created",
    "admin",
    newAdmin.id,
    { email: newAdmin.email, name: newAdmin.name },
    req.ip
  );

  logger.info(`Admin created by main admin`, { 
    adminId: newAdmin.id, 
    createdBy: req.admin?.userId 
  });

  res.status(201).json({
    message: "Admin created successfully",
    admin: newAdmin,
  });
}));

/**
 * PATCH /api/admin/admins/:id/toggle
 * Toggle admin active status (main admin only)
 */
router.patch("/admins/:id/toggle", asyncHandler(async (req: AdminRequest, res) => {
  if (!requireMainAdmin(req, res)) return;

  const { id } = req.params;

  if (!id) {
    return res.status(400).json({ error: "Admin ID is required" });
  }

  // Prevent main admin from deactivating themselves
  if (id === req.admin?.userId) {
    return res.status(400).json({ error: "Cannot deactivate yourself" });
  }

  const admin = await prisma.admin.findUnique({
    where: { id },
  });

  if (!admin) {
    return res.status(404).json({ error: "Admin not found" });
  }

  if (admin.role === "MAIN_ADMIN") {
    return res.status(403).json({ error: "Cannot modify main admin" });
  }

  const updatedAdmin = await prisma.admin.update({
    where: { id },
    data: {
      isActive: !admin.isActive,
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      isActive: true,
      updatedAt: true,
    },
  });

  await logAdminActivity(
    req.admin?.userId || "unknown",
    admin.isActive ? "admin_deactivated" : "admin_activated",
    "admin",
    id,
    { email: admin.email, name: admin.name, isActive: updatedAdmin.isActive },
    req.ip
  );

  logger.info(`Admin ${admin.isActive ? "deactivated" : "activated"} by main admin`, { 
    adminId: id, 
    mainAdminId: req.admin?.userId 
  });

  res.json({
    message: `Admin ${updatedAdmin.isActive ? "activated" : "deactivated"} successfully`,
    admin: updatedAdmin,
  });
}));

/**
 * DELETE /api/admin/admins/:id
 * Delete an admin (main admin only)
 */
router.delete("/admins/:id", asyncHandler(async (req: AdminRequest, res) => {
  if (!requireMainAdmin(req, res)) return;

  const { id } = req.params;

  if (!id) {
    return res.status(400).json({ error: "Admin ID is required" });
  }

  // Prevent main admin from deleting themselves
  if (id === req.admin?.userId) {
    return res.status(400).json({ error: "Cannot delete yourself" });
  }

  const admin = await prisma.admin.findUnique({
    where: { id },
  });

  if (!admin) {
    return res.status(404).json({ error: "Admin not found" });
  }

  if (admin.role === "MAIN_ADMIN") {
    return res.status(403).json({ error: "Cannot delete main admin" });
  }

  await prisma.admin.delete({
    where: { id },
  });

  await logAdminActivity(
    req.admin?.userId || "unknown",
    "admin_deleted",
    "admin",
    id,
    { email: admin.email, name: admin.name },
    req.ip
  );

  logger.info(`Admin deleted by main admin`, { 
    adminId: id, 
    mainAdminId: req.admin?.userId 
  });

  res.json({
    message: "Admin deleted successfully",
  });
}));

/**
 * PATCH /api/admin/admins/:id
 * Update admin details (main admin only)
 */
router.patch("/admins/:id", asyncHandler(async (req: AdminRequest, res) => {
  if (!requireMainAdmin(req, res)) return;

  const { id } = req.params;
  const { name, email, password } = req.body;

  if (!id) {
    return res.status(400).json({ error: "Admin ID is required" });
  }

  const admin = await prisma.admin.findUnique({
    where: { id },
  });

  if (!admin) {
    return res.status(404).json({ error: "Admin not found" });
  }

  if (admin.role === "MAIN_ADMIN") {
    return res.status(403).json({ error: "Cannot modify main admin" });
  }

  const updateData: any = {};
  if (name !== undefined) updateData.name = name;
  if (email !== undefined) {
    // Check email uniqueness
    const existing = await prisma.admin.findUnique({
      where: { email },
    });
    if (existing && existing.id !== id) {
      return res.status(409).json({ error: "Email already in use" });
    }
    updateData.email = email;
  }
  if (password !== undefined) {
    const { hashPassword } = await import("../../utils/auth.js");
    updateData.password = await hashPassword(password);
  }

  const updatedAdmin = await prisma.admin.update({
    where: { id },
    data: updateData,
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      isActive: true,
      updatedAt: true,
    },
  });

  await logAdminActivity(
    req.admin?.userId || "unknown",
    "admin_updated",
    "admin",
    id,
    updateData,
    req.ip
  );

  logger.info(`Admin updated by main admin`, { 
    adminId: id, 
    mainAdminId: req.admin?.userId 
  });

  res.json({
    message: "Admin updated successfully",
    admin: updatedAdmin,
  });
}));

export default router;
