import { Server, Socket } from "socket.io";
import { prisma } from "../lib/prisma.js";
import { socketConnections, rooms } from "../store/connectionStore.js";
import { canJoinRoom, broadcastParticipants } from "../utils/roomManager.js";
import { MAX_ROOM_ID_LENGTH, MAX_NAME_LENGTH } from "../config/constants.js";
import { checkRequestRateLimit, clearSocketRateLimit } from "../utils/socketRateLimit.js";
import { JoinRequestStatus } from "@prisma/client";

export function setupJoinRequestHandlers(io: Server, socket: Socket): void {
  // Cleanup rate limits on disconnect
  socket.on("disconnect", () => {
    clearSocketRateLimit(socket.id);
  });

  // Request to join a meeting (requires approval)
  socket.on("request-join", async ({ roomId, name, email }: { roomId: string; name: string; email?: string }) => {
    await handleJoinRequest(io, socket, roomId, name, email);
  });

  // Approve a join request (host only)
  socket.on("approve-request", async ({ requestId, userId }: { requestId: string; userId: string }) => {
    await handleApproveRequest(io, socket, requestId, userId);
  });

  // Decline a join request (host only)
  socket.on("decline-request", async ({ requestId, userId }: { requestId: string; userId: string }) => {
    await handleDeclineRequest(io, socket, requestId, userId);
  });

  // Get pending requests for a meeting (host only)
  socket.on("get-pending-requests", async ({ roomId }: { roomId: string }) => {
    await handleGetPendingRequests(io, socket, roomId);
  });
}

async function handleJoinRequest(
  io: Server,
  socket: Socket,
  roomId: string,
  name: string,
  email?: string
): Promise<void> {
  try {
    // Rate limiting check
    if (!checkRequestRateLimit(socket.id)) {
      socket.emit("request-error", { 
        message: "Too many requests. Please wait a moment." 
      });
      return;
    }

    // Validate inputs
    if (!roomId || !name || roomId.length > MAX_ROOM_ID_LENGTH || name.length > MAX_NAME_LENGTH) {
      socket.emit("request-error", { message: "Invalid room ID or name" });
      return;
    }

    // Get or create meeting
    let meeting = await prisma.meeting.findUnique({
      where: { roomId },
      select: { id: true, roomId: true, requiresApproval: true },
    });

    if (!meeting) {
      // Create meeting (first person becomes host)
      meeting = await prisma.meeting.create({
        data: {
          roomId,
          title: `Meeting ${roomId}`,
          requiresApproval: false, // First person can join directly
        },
        select: { id: true, roomId: true, requiresApproval: true },
      });
    }

    // Get or create user
    const user = await getOrCreateUser(name, email);

    // Check if meeting requires approval
    if (meeting.requiresApproval) {
      // Check if request already exists
      const existingRequest = await prisma.joinRequest.findFirst({
        where: {
          userId: user.id,
          meetingId: meeting.id,
          status: JoinRequestStatus.pending,
        },
      });

      if (existingRequest) {
        socket.emit("request-status", {
          status: "pending",
          message: "Your request is already pending approval",
        });
        return;
      }

      // Create join request
      const joinRequest = await prisma.joinRequest.create({
        data: {
          userId: user.id,
          meetingId: meeting.id,
          name: user.name,
          email: user.email || null,
          status: JoinRequestStatus.pending,
        },
        include: {
          user: true,
        },
      });

      // Notify user that request was sent
      socket.emit("request-sent", {
        requestId: joinRequest.id,
        message: "Join request sent. Waiting for approval...",
      });

      // Notify all hosts in the meeting
      const hosts = await prisma.meetingParticipant.findMany({
        where: {
          meetingId: meeting.id,
          isHost: true,
          leftAt: null,
        },
        include: {
          user: true,
        },
      });

      // Find host sockets and notify them
      const hostSockets = findHostSockets(io, meeting.id, hosts.map((h: typeof hosts[0]) => h.userId));
      
      hostSockets.forEach(hostSocket => {
        hostSocket.emit("new-join-request", {
          requestId: joinRequest.id,
          userId: user.id,
          name: user.name,
          email: user.email,
          requestedAt: joinRequest.requestedAt,
        });
      });

      console.log(`Join request created: ${user.name} requested to join ${meeting.roomId}`);
    } else {
      // No approval needed, join directly
      socket.emit("request-approved", {
        message: "You can join directly",
        roomId: meeting.roomId,
      });
    }
  } catch (error) {
    console.error("Error handling join request:", error);
    socket.emit("request-error", { message: "Failed to process join request" });
  }
}

async function handleApproveRequest(
  io: Server,
  socket: Socket,
  requestId: string,
  userId: string
): Promise<void> {
  try {
    // Verify socket is a host
    const connection = socketConnections[socket.id];
    if (!connection) {
      socket.emit("request-error", { message: "Not connected" });
      return;
    }

    const isHost = await verifyHost(connection.meetingDbId, connection.userId);
    if (!isHost) {
      socket.emit("request-error", { message: "Only hosts can approve requests" });
      return;
    }

    // Get the join request
    const joinRequest = await prisma.joinRequest.findUnique({
      where: { id: requestId },
      include: {
        user: true,
        meeting: true,
      },
    });

    if (!joinRequest || joinRequest.status !== JoinRequestStatus.pending) {
      socket.emit("request-error", { message: "Request not found or already processed" });
      return;
    }

    // Update request status
    await prisma.joinRequest.update({
      where: { id: requestId },
      data: {
        status: JoinRequestStatus.approved,
        respondedAt: new Date(),
      },
    });

    // Create participant (user joins the meeting)
    await prisma.meetingParticipant.upsert({
      where: {
        userId_meetingId: {
          userId: joinRequest.userId,
          meetingId: joinRequest.meetingId,
        },
      },
      update: {
        joinedAt: new Date(),
        leftAt: null,
      },
      create: {
        userId: joinRequest.userId,
        meetingId: joinRequest.meetingId,
        isHost: false,
      },
    });

    // Notify the user that their request was approved
    const userSockets = findUserSockets(io, joinRequest.userId);
    userSockets.forEach(userSocket => {
      userSocket.emit("request-approved", {
        requestId,
        message: "Your join request has been approved!",
        roomId: joinRequest.meeting.roomId,
      });
    });

    // Notify all hosts
    const hosts = await prisma.meetingParticipant.findMany({
      where: {
        meetingId: joinRequest.meetingId,
        isHost: true,
        leftAt: null,
      },
    });

    const hostSockets = findHostSockets(io, joinRequest.meetingId, hosts.map((h: typeof hosts[0]) => h.userId));
    hostSockets.forEach(hostSocket => {
      hostSocket.emit("request-processed", {
        requestId,
        userId: joinRequest.userId,
        name: joinRequest.user.name,
        status: "approved",
      });
    });

    console.log(`Join request approved: ${joinRequest.user.name} can now join ${joinRequest.meeting.roomId}`);
  } catch (error) {
    console.error("Error approving request:", error);
    socket.emit("request-error", { message: "Failed to approve request" });
  }
}

async function handleDeclineRequest(
  io: Server,
  socket: Socket,
  requestId: string,
  userId: string
): Promise<void> {
  try {
    // Verify socket is a host
    const connection = socketConnections[socket.id];
    if (!connection) {
      socket.emit("request-error", { message: "Not connected" });
      return;
    }

    const isHost = await verifyHost(connection.meetingDbId, connection.userId);
    if (!isHost) {
      socket.emit("request-error", { message: "Only hosts can decline requests" });
      return;
    }

    // Get the join request
    const joinRequest = await prisma.joinRequest.findUnique({
      where: { id: requestId },
      include: {
        user: true,
        meeting: true,
      },
    });

    if (!joinRequest || joinRequest.status !== JoinRequestStatus.pending) {
      socket.emit("request-error", { message: "Request not found or already processed" });
      return;
    }

    // Update request status
    await prisma.joinRequest.update({
      where: { id: requestId },
      data: {
        status: JoinRequestStatus.declined,
        respondedAt: new Date(),
      },
    });

    // Notify the user that their request was declined
    const userSockets = findUserSockets(io, joinRequest.userId);
    userSockets.forEach(userSocket => {
      userSocket.emit("request-declined", {
        requestId,
        message: "Your join request has been declined",
      });
    });

    // Notify all hosts
    const hosts = await prisma.meetingParticipant.findMany({
      where: {
        meetingId: joinRequest.meetingId,
        isHost: true,
        leftAt: null,
      },
    });

    const hostSockets = findHostSockets(io, joinRequest.meetingId, hosts.map((h: typeof hosts[0]) => h.userId));
    hostSockets.forEach(hostSocket => {
      hostSocket.emit("request-processed", {
        requestId,
        userId: joinRequest.userId,
        name: joinRequest.user.name,
        status: "declined",
      });
    });

    console.log(`Join request declined: ${joinRequest.user.name} cannot join ${joinRequest.meeting.roomId}`);
  } catch (error) {
    console.error("Error declining request:", error);
    socket.emit("request-error", { message: "Failed to decline request" });
  }
}

async function handleGetPendingRequests(
  io: Server,
  socket: Socket,
  roomId: string
): Promise<void> {
  try {
    const connection = socketConnections[socket.id];
    if (!connection) {
      socket.emit("request-error", { message: "Not connected" });
      return;
    }

    // Get meeting
    const meeting = await prisma.meeting.findUnique({
      where: { roomId },
    });

    if (!meeting) {
      socket.emit("request-error", { message: "Meeting not found" });
      return;
    }

    // Verify is host
    const isHost = await verifyHost(meeting.id, connection.userId);
    if (!isHost) {
      socket.emit("request-error", { message: "Only hosts can view pending requests" });
      return;
    }

    // Get pending requests
    const pendingRequests = await prisma.joinRequest.findMany({
      where: {
        meetingId: meeting.id,
        status: JoinRequestStatus.pending,
      },
      include: {
        user: true,
      },
      orderBy: {
        requestedAt: "asc",
      },
    });

    socket.emit("pending-requests", {
      requests: pendingRequests.map((req: typeof pendingRequests[0]) => ({
        id: req.id,
        userId: req.userId,
        name: req.user.name,
        email: req.user.email,
        requestedAt: req.requestedAt,
      })),
    });
  } catch (error) {
    console.error("Error getting pending requests:", error);
    socket.emit("request-error", { message: "Failed to get pending requests" });
  }
}

// Helper functions
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
  }

  return user;
}

async function verifyHost(meetingId: string, userId: string): Promise<boolean> {
  const participant = await prisma.meetingParticipant.findUnique({
    where: {
      userId_meetingId: {
        userId,
        meetingId,
      },
    },
    select: { isHost: true, leftAt: true },
  });

  return participant?.isHost === true && participant.leftAt === null;
}

function findHostSockets(io: Server, meetingId: string, hostUserIds: string[]): Socket[] {
  const sockets: Socket[] = [];
  
  for (const [socketId, connection] of Object.entries(socketConnections)) {
    if (connection.meetingDbId === meetingId && hostUserIds.includes(connection.userId)) {
      const socket = io.sockets.sockets.get(socketId);
      if (socket) {
        sockets.push(socket);
      }
    }
  }
  
  return sockets;
}

function findUserSockets(io: Server, userId: string): Socket[] {
  const sockets: Socket[] = [];
  
  for (const [socketId, connection] of Object.entries(socketConnections)) {
    if (connection.userId === userId) {
      const socket = io.sockets.sockets.get(socketId);
      if (socket) {
        sockets.push(socket);
      }
    }
  }
  
  return sockets;
}

