import { Server, Namespace } from "socket.io";
import { prisma } from "../../lib/prisma.js";
import { socketConnections, rooms } from "../../store/connectionStore.js";
import { logger } from "../../utils/logger.js";
import { verifyToken } from "../../utils/auth.js";

// Store admin socket connections
const adminSockets = new Map<string, { socketId: string; userId: string; name: string }>();

/**
 * Setup admin namespace for real-time admin updates
 */
export function setupAdminNamespace(io: Server): Namespace {
  const adminNamespace = io.of("/admin");

  adminNamespace.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.replace("Bearer ", "");

      if (!token) {
        return next(new Error("Authentication required"));
      }

      const payload = verifyToken(token);
      if (!payload) {
        return next(new Error("Invalid token"));
      }

      // Check if user is admin
      const user = await prisma.user.findUnique({
        where: { id: payload.userId },
        select: { id: true, name: true, email: true, isAdmin: true },
      });

      if (!user || !user.isAdmin) {
        return next(new Error("Admin access required"));
      }

      // Attach user info to socket
      socket.data.user = {
        userId: user.id,
        name: user.name,
        email: user.email,
        isAdmin: true,
      };

      next();
    } catch (error) {
      next(new Error("Authentication failed"));
    }
  });

  adminNamespace.on("connection", async (socket) => {
    const user = socket.data.user;
    if (!user) {
      socket.disconnect();
      return;
    }

    adminSockets.set(socket.id, {
      socketId: socket.id,
      userId: user.userId,
      name: user.name,
    });

    logger.info("Admin connected", { socketId: socket.id, userId: user.userId, name: user.name });

    // Send initial stats
    await sendStatsUpdate(adminNamespace);

    // Handle admin requests
    socket.on("get-stats", async () => {
      await sendStatsUpdate(adminNamespace);
    });

    socket.on("disconnect", () => {
      adminSockets.delete(socket.id);
      logger.info("Admin disconnected", { socketId: socket.id });
    });
  });

  return adminNamespace;
}

/**
 * Send stats update to all admin clients
 */
export async function sendStatsUpdate(adminNamespace: Namespace): Promise<void> {
  try {
    const totalConnections = Object.keys(socketConnections).length;
    const activeRooms = Object.keys(rooms).length;

    const [totalUsers, totalMeetings, activeMeetings] = await Promise.all([
      prisma.user.count(),
      prisma.meeting.count(),
      prisma.meetingParticipant.count({
        where: { leftAt: null },
      }),
    ]);

    const roomStats = Object.entries(rooms).map(([roomId, participants]) => ({
      roomId,
      participantCount: Object.keys(participants).length,
    }));

    adminNamespace.emit("stats-update", {
      timestamp: new Date().toISOString(),
      connections: {
        active: totalConnections,
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
    });
  } catch (error) {
    logger.error("Error sending stats update", { error });
  }
}

/**
 * Emit event to admin namespace when user joins meeting
 */
export function emitUserJoined(adminNamespace: Namespace, data: {
  userId: string;
  userName: string;
  roomId: string;
  meetingId: string;
}): void {
  adminNamespace.emit("user-joined", {
    ...data,
    timestamp: new Date().toISOString(),
  });
}

/**
 * Emit event to admin namespace when user leaves meeting
 */
export function emitUserLeft(adminNamespace: Namespace, data: {
  userId: string;
  userName: string;
  roomId: string;
  meetingId: string;
}): void {
  adminNamespace.emit("user-left", {
    ...data,
    timestamp: new Date().toISOString(),
  });
}

/**
 * Emit event to admin namespace when new meeting is created
 */
export function emitNewMeeting(adminNamespace: Namespace, data: {
  meetingId: string;
  roomId: string;
  title?: string;
  createdBy?: string;
}): void {
  adminNamespace.emit("new-meeting", {
    ...data,
    timestamp: new Date().toISOString(),
  });
}

/**
 * Emit event to admin namespace when join request is created
 */
export function emitNewJoinRequest(adminNamespace: Namespace, data: {
  requestId: string;
  userId: string;
  userName: string;
  meetingId: string;
  roomId: string;
}): void {
  adminNamespace.emit("new-join-request", {
    ...data,
    timestamp: new Date().toISOString(),
  });
}

/**
 * Get admin namespace instance (helper function)
 */
export function getAdminNamespace(io: Server): Namespace | null {
  return io.of("/admin") || null;
}

