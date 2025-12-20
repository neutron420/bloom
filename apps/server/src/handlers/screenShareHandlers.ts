import { Server, Socket } from "socket.io";
import { prisma } from "../lib/prisma.js";
import { socketConnections } from "../store/connectionStore.js";
import { checkRequestRateLimit } from "../utils/socketRateLimit.js";

export function setupScreenShareHandlers(io: Server, socket: Socket): void {
  // Start screen sharing
  socket.on("start-screen-share", async () => {
    await handleStartScreenShare(io, socket);
  });

  // Stop screen sharing
  socket.on("stop-screen-share", async () => {
    await handleStopScreenShare(io, socket);
  });

  // Get current screen sharer for a room
  socket.on("get-screen-sharer", async ({ roomId }: { roomId: string }) => {
    await handleGetScreenSharer(io, socket, roomId);
  });
}

async function handleStartScreenShare(io: Server, socket: Socket): Promise<void> {
  try {
    // Rate limiting check
    if (!checkRequestRateLimit(socket.id)) {
      socket.emit("screen-share-error", {
        message: "Too many requests. Please wait a moment.",
      });
      return;
    }

    // Get socket connection info
    const connection = socketConnections[socket.id];
    if (!connection) {
      socket.emit("screen-share-error", { message: "Not connected to a room" });
      return;
    }

    const { roomId, meetingDbId, userId } = connection;

    // Check if someone else is already sharing in this room
    // Only ONE person can share screen at a time per room
    const activeShare = await prisma.screenShare.findFirst({
      where: {
        meetingId: meetingDbId,
        isActive: true,
        userId: { not: userId }, // Not the current user
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (activeShare) {
      // Someone else is already sharing - block this request
      socket.emit("screen-share-error", {
        message: `${activeShare.user.name} is already sharing their screen. Please ask them to stop sharing first.`,
        code: "SCREEN_SHARE_ACTIVE",
        currentSharer: {
          userId: activeShare.userId,
          userName: activeShare.user.name,
        },
      });
      const sharerSocketId = Object.keys(socketConnections).find(
        (sid) => {
          const conn = socketConnections[sid];
          return conn && conn.userId === activeShare.userId && conn.meetingDbId === meetingDbId;
        }
      );
      
      if (sharerSocketId) {
        io.to(sharerSocketId).emit("screen-share-requested", {
          message: `${connection.name} wants to share their screen`,
          requesterId: userId,
          requesterName: connection.name,
        });
      }
      
      return;
    }

    // Stop any previous active share by this user
    await prisma.screenShare.updateMany({
      where: {
        userId,
        meetingId: meetingDbId,
        isActive: true,
      },
      data: {
        isActive: false,
        stoppedAt: new Date(),
      },
    });

    // Create new screen share session
    const screenShare = await prisma.screenShare.create({
      data: {
        userId,
        meetingId: meetingDbId,
        isActive: true,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    // Broadcast to all participants in the room
    const shareData = {
      shareId: screenShare.id,
      userId: screenShare.userId,
      userName: screenShare.user.name,
      startedAt: screenShare.startedAt,
    };

    io.to(roomId).emit("screen-share-started", shareData);
    console.log(`${screenShare.user.name} started sharing screen in room ${roomId}`);
  } catch (error) {
    console.error("Error starting screen share:", error);
    socket.emit("screen-share-error", { message: "Failed to start screen sharing" });
  }
}

async function handleStopScreenShare(io: Server, socket: Socket): Promise<void> {
  try {
    // Get socket connection info
    const connection = socketConnections[socket.id];
    if (!connection) {
      socket.emit("screen-share-error", { message: "Not connected to a room" });
      return;
    }

    const { roomId, meetingDbId, userId } = connection;

    // Find active screen share by this user
    const activeShare = await prisma.screenShare.findFirst({
      where: {
        userId,
        meetingId: meetingDbId,
        isActive: true,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!activeShare) {
      socket.emit("screen-share-error", { message: "No active screen share found" });
      return;
    }

    // Stop the screen share
    await prisma.screenShare.update({
      where: { id: activeShare.id },
      data: {
        isActive: false,
        stoppedAt: new Date(),
      },
    });

    // Broadcast to all participants in the room
    io.to(roomId).emit("screen-share-stopped", {
      shareId: activeShare.id,
      userId: activeShare.userId,
      userName: activeShare.user.name,
    });

    console.log(`${activeShare.user.name} stopped sharing screen in room ${roomId}`);
  } catch (error) {
    console.error("Error stopping screen share:", error);
    socket.emit("screen-share-error", { message: "Failed to stop screen sharing" });
  }
}

async function handleGetScreenSharer(
  io: Server,
  socket: Socket,
  roomId: string
): Promise<void> {
  try {
    // Validate roomId
    if (!roomId || typeof roomId !== "string") {
      socket.emit("screen-share-error", { message: "Invalid room ID" });
      return;
    }

    // Get meeting
    const meeting = await prisma.meeting.findUnique({
      where: { roomId },
      select: { id: true },
    });

    if (!meeting) {
      socket.emit("screen-share-error", { message: "Meeting not found" });
      return;
    }

    // Find active screen share in this meeting
    const activeShare = await prisma.screenShare.findFirst({
      where: {
        meetingId: meeting.id,
        isActive: true,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (activeShare) {
      socket.emit("screen-sharer-info", {
        shareId: activeShare.id,
        userId: activeShare.userId,
        userName: activeShare.user.name,
        startedAt: activeShare.startedAt,
      });
    } else {
      socket.emit("screen-sharer-info", null);
    }
  } catch (error) {
    console.error("Error getting screen sharer:", error);
    socket.emit("screen-share-error", { message: "Failed to get screen sharer info" });
  }
}

