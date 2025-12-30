import { Server, Socket } from "socket.io";
import { prisma } from "../lib/prisma.js";
import { socketConnections, rooms } from "../store/connectionStore.js";
import { checkRateLimit, clearRateLimit } from "../utils/rateLimit.js";
import { canJoinRoom, broadcastParticipants } from "../utils/roomManager.js";
import { MAX_ROOM_ID_LENGTH, MAX_NAME_LENGTH } from "../config/constants.js";
import { setupJoinRequestHandlers } from "./joinRequestHandlers.js";
import { setupChatHandlers } from "./chatHandlers.js";
import { setupScreenShareHandlers } from "./screenShareHandlers.js";
import { setupWebRTCHandlers } from "./webrtcHandlers.js";
import { logger } from "../utils/logger.js";
import type { AuthenticatedSocket } from "../middleware/socketAuth.js";
import { getAdminNamespace, emitUserJoined, emitUserLeft, emitNewMeeting } from "../admin-be/handlers/adminHandlers.js";

export function setupSocketHandlers(io: Server): void {
  io.on("connection", (socket: Socket) => {
    const authSocket = socket as AuthenticatedSocket;
    logger.info("User connected", {
      socketId: socket.id,
      userId: authSocket.userId,
      userName: authSocket.userName,
      ip: socket.handshake.address,
    });

    // Regular join (direct join, no approval needed)
    socket.on("join-room", async ({ roomId, name, email }: { roomId: string; name: string; email?: string }) => {
      await handleJoinRoom(io, socket, roomId, name, email);
    });

    // Setup join request handlers
    setupJoinRequestHandlers(io, socket);

    // Setup chat handlers
    setupChatHandlers(io, socket);

    // Setup screen sharing handlers
    setupScreenShareHandlers(io, socket);

    // Setup WebRTC/MediaSoup handlers
    setupWebRTCHandlers(io, socket);

    // Single disconnect handler (combines cleanup and database updates)
    socket.on("disconnect", async () => {
      clearRateLimit(socket.id);
      // Cleanup MediaSoup resources
      const { cleanupMediaSoupResources } = await import("../config/mediasoup.js");
      cleanupMediaSoupResources(socket.id);
      await handleDisconnect(io, socket);
    });
  });
}

async function handleJoinRoom(
  io: Server,
  socket: Socket,
  roomId: string,
  name: string,
  email?: string
): Promise<void> {
  try {
    // Rate limiting check
    if (!checkRateLimit(socket.id)) {
      socket.emit("error", { message: "Too many join attempts. Please wait a moment." });
      return;
    }
    
    // Validate inputs
    if (!roomId || !name || roomId.length > MAX_ROOM_ID_LENGTH || name.length > MAX_NAME_LENGTH) {
      socket.emit("error", { message: "Invalid room ID or name" });
      return;
    }

    // Check connection limits
    const canJoin = canJoinRoom(roomId);
    if (!canJoin.allowed) {
      socket.emit("error", { message: canJoin.reason || "Cannot join room" });
      return;
    }
    
    logger.info("User joining room", {
      socketId: socket.id,
      name,
      roomId,
      userId: (socket as AuthenticatedSocket).userId,
    });
    
    // Leave any previous rooms this socket might be in
    await leavePreviousRooms(io, socket);

    // Create or get user in database
    const user = await getOrCreateUser(name, email);

    // Create or get meeting in database
    const meeting = await getOrCreateMeeting(roomId);

    // Check if this is the first user (becomes host)
    const existingParticipants = await prisma.meetingParticipant.count({
      where: {
        meetingId: meeting.id,
        leftAt: null,
      },
    });

    const isFirstUser = existingParticipants === 0;

    // Create or update meeting participant
    await upsertParticipant(user.id, meeting.id, meeting.roomId, isFirstUser);

    // Track socket connection
    socketConnections[socket.id] = {
      roomId: roomId,
      meetingDbId: meeting.id,
      userId: user.id,
      name: user.name,
    };

    // Join the room
    socket.join(roomId);

    // Initialize room if it doesn't exist
    if (!rooms[roomId]) {
      rooms[roomId] = {};
    }

    // Add the user to the room
    rooms[roomId][socket.id] = user.name;

    const participantList = Object.values(rooms[roomId]);
    logger.debug(`Room ${roomId} now has ${participantList.length} participants`, { roomId, participantCount: participantList.length });

    // Emit to the newly joined socket immediately
    socket.emit("participants", participantList);

    // Check if someone is currently sharing screen and notify the new participant
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
      socket.emit("screen-share-started", {
        shareId: activeShare.id,
        userId: activeShare.userId,
        userName: activeShare.user.name,
        startedAt: activeShare.startedAt,
      });
    }

    // Debounce broadcast to others
    broadcastParticipants(io, roomId);

    // Emit admin events
    const adminNamespace = getAdminNamespace(io);
    if (adminNamespace) {
      emitUserJoined(adminNamespace, {
        userId: user.id,
        userName: user.name,
        roomId: roomId,
        meetingId: meeting.id,
      });

      // If this is a new meeting, emit new meeting event
      if (isFirstUser) {
        emitNewMeeting(adminNamespace, {
          meetingId: meeting.id,
          roomId: meeting.roomId,
          ...(meeting.title && { title: meeting.title }),
          createdBy: user.id,
        });
      }
    }
  } catch (error) {
    logger.error("Error joining room", { error, socketId: socket.id, roomId });
    socket.emit("error", { message: "Failed to join room" });
  }
}

async function handleDisconnect(io: Server, socket: Socket): Promise<void> {
  const authSocket = socket as AuthenticatedSocket;
  logger.info("User disconnected", {
    socketId: socket.id,
    userId: authSocket.userId,
    userName: authSocket.userName,
  });
  
  const connection = socketConnections[socket.id];
  
  if (connection) {
    // Stop any active screen share by this user
    try {
      const activeShare = await prisma.screenShare.findFirst({
        where: {
          userId: connection.userId,
          meetingId: connection.meetingDbId,
          isActive: true,
        },
      });

      if (activeShare) {
        await prisma.screenShare.update({
          where: { id: activeShare.id },
          data: {
            isActive: false,
            stoppedAt: new Date(),
          },
        });

        // Notify room that screen share stopped
        io.to(connection.roomId).emit("screen-share-stopped", {
          shareId: activeShare.id,
          userId: connection.userId,
          userName: connection.name,
        });
        logger.info("Screen share stopped on disconnect", {
          userId: connection.userId,
          userName: connection.name,
          shareId: activeShare.id,
        });
      }
    } catch (error) {
      logger.error("Error stopping screen share on disconnect", { error, userId: connection.userId });
    }

    // Mark participant as left in database
    try {
      await prisma.meetingParticipant.updateMany({
        where: {
          userId: connection.userId,
          meetingId: connection.meetingDbId,
          leftAt: null,
        },
        data: {
          leftAt: new Date(),
        },
      });
      logger.info("User left meeting", {
        userId: connection.userId,
        userName: connection.name,
        roomId: connection.roomId,
      });

      // Emit admin event
      const adminNamespace = getAdminNamespace(io);
      if (adminNamespace) {
        emitUserLeft(adminNamespace, {
          userId: connection.userId,
          userName: connection.name,
          roomId: connection.roomId,
          meetingId: connection.meetingDbId,
        });
      }
    } catch (error) {
      logger.error("Error updating participant", { error, userId: connection.userId });
    }

    // Update room participants
    const roomId = connection.roomId;
    const room = rooms[roomId];
    if (room && room[socket.id]) {
      const name = room[socket.id];
      delete room[socket.id];

      broadcastParticipants(io, roomId);

      // Clean up empty rooms
      setTimeout(() => {
        const currentRoom = rooms[roomId];
        if (currentRoom && Object.keys(currentRoom).length === 0) {
          delete rooms[roomId];
        }
      }, 1000);
    }

    delete socketConnections[socket.id];
  } else {
    // Fallback for old connections without database tracking
    for (const roomId in rooms) {
      const room = rooms[roomId];
      if (room && room[socket.id]) {
        delete room[socket.id];
        broadcastParticipants(io, roomId);
      }
    }
  }
}

async function leavePreviousRooms(io: Server, socket: Socket): Promise<void> {
  const prevConnection = socketConnections[socket.id];
  if (!prevConnection) return;

  const currentRooms = Array.from(socket.rooms);
  currentRooms.forEach(room => {
    if (room !== socket.id && rooms[room]) {
      delete rooms[room][socket.id];
      if (Object.keys(rooms[room]).length === 0) {
        delete rooms[room];
      } else {
        io.to(room).emit("participants", Object.values(rooms[room]));
      }
    }
  });

  // Mark participant as left in database
  const { meetingDbId: prevMeetingDbId, userId: prevUserId } = prevConnection;
  if (prevMeetingDbId) {
    await prisma.meetingParticipant.updateMany({
      where: {
        userId: prevUserId,
        meetingId: prevMeetingDbId,
        leftAt: null,
      },
      data: {
        leftAt: new Date(),
      },
    });
  }
}

async function getOrCreateUser(name: string, email?: string) {
  let user = await prisma.user.findFirst({
    where: email ? { email } : { name },
    select: { id: true, name: true, email: true },
  });

  if (!user) {
    user = await prisma.user.create({
      data: {
        name,
        email: email || null,
      },
      select: { id: true, name: true, email: true },
    });
    logger.info("Created new user", { userId: user.id, userName: user.name, email: user.email });
  }

  return user;
}

async function getOrCreateMeeting(roomId: string) {
  let meeting = await prisma.meeting.findUnique({
    where: { roomId },
    select: { id: true, roomId: true, title: true },
  });

  if (!meeting) {
    meeting = await prisma.meeting.create({
      data: {
        roomId,
        title: `Meeting ${roomId}`,
      },
      select: { id: true, roomId: true, title: true },
    });
    logger.info("Created new meeting", { meetingId: meeting.id, roomId: meeting.roomId });
  }

  return meeting;
}

async function upsertParticipant(userId: string, meetingId: string, roomId: string, isFirstUser: boolean = false): Promise<void> {
  // Check if meeting exists and has participants
  const existingParticipants = await prisma.meetingParticipant.count({
    where: {
      meetingId,
      leftAt: null,
    },
  });

  // First user becomes host
  const isHost = isFirstUser || existingParticipants === 0;

  await prisma.meetingParticipant.upsert({
    where: {
      userId_meetingId: {
        userId,
        meetingId,
      },
    },
    update: {
      joinedAt: new Date(),
      leftAt: null,
      isHost: isHost, // Update host status if needed
    },
    create: {
      userId,
      meetingId,
      isHost: isHost,
    },
  });
  
  if (isHost) {
    logger.info("User joined meeting as HOST", { userId, meetingId, roomId });
  } else {
    logger.debug("User joined meeting", { userId, meetingId, roomId });
  }
}

