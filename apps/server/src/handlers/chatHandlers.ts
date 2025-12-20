import { Server, Socket } from "socket.io";
import { prisma } from "../lib/prisma.js";
import { socketConnections } from "../store/connectionStore.js";
import { MAX_MESSAGE_LENGTH } from "../config/constants.js";
import { checkMessageRateLimit, clearSocketRateLimit } from "../utils/socketRateLimit.js";

export function setupChatHandlers(io: Server, socket: Socket): void {
  // Cleanup rate limits on disconnect
  socket.on("disconnect", () => {
    clearSocketRateLimit(socket.id);
  });

  // Send a chat message
  socket.on("send-message", async ({ message }: { message: string }) => {
    await handleSendMessage(io, socket, message);
  });

  // Get chat history for a room
  socket.on("get-chat-history", async ({ roomId, limit = 50 }: { roomId: string; limit?: number }) => {
    await handleGetChatHistory(io, socket, roomId, limit);
  });

  // Delete a message (host only)
  socket.on("delete-message", async ({ messageId }: { messageId: string }) => {
    await handleDeleteMessage(io, socket, messageId);
  });
}

async function handleSendMessage(
  io: Server,
  socket: Socket,
  message: string
): Promise<void> {
  try {
    // Rate limiting check
    if (!checkMessageRateLimit(socket.id)) {
      socket.emit("chat-error", { 
        message: "Too many messages. Please wait a moment before sending more." 
      });
      return;
    }

    // Validate message
    if (!message || typeof message !== "string") {
      socket.emit("chat-error", { message: "Invalid message" });
      return;
    }

    const trimmedMessage = message.trim();
    if (trimmedMessage.length === 0) {
      socket.emit("chat-error", { message: "Message cannot be empty" });
      return;
    }

    if (trimmedMessage.length > MAX_MESSAGE_LENGTH) {
      socket.emit("chat-error", { 
        message: `Message too long. Max ${MAX_MESSAGE_LENGTH} characters` 
      });
      return;
    }

    // Get socket connection info
    const connection = socketConnections[socket.id];
    if (!connection) {
      socket.emit("chat-error", { message: "Not connected to a room" });
      return;
    }

    // Get user info
    const user = await prisma.user.findUnique({
      where: { id: connection.userId },
      select: { id: true, name: true },
    });

    if (!user) {
      socket.emit("chat-error", { message: "User not found" });
      return;
    }

    // Create chat message in database
    const chatMessage = await prisma.chatMessage.create({
      data: {
        userId: user.id,
        meetingId: connection.meetingDbId,
        message: trimmedMessage,
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

    // Broadcast message to all participants in the room
    const messageData = {
      id: chatMessage.id,
      userId: chatMessage.userId,
      userName: user.name,
      message: chatMessage.message,
      createdAt: chatMessage.createdAt,
    };

    io.to(connection.roomId).emit("new-message", messageData);

    console.log(`Chat message from ${user.name} in room ${connection.roomId}`);
  } catch (error) {
    console.error("Error sending message:", error);
    socket.emit("chat-error", { message: "Failed to send message" });
  }
}

async function handleGetChatHistory(
  io: Server,
  socket: Socket,
  roomId: string,
  limit: number
): Promise<void> {
  try {
    // Validate inputs
    if (!roomId || typeof roomId !== "string") {
      socket.emit("chat-error", { message: "Invalid room ID" });
      return;
    }

    const validatedLimit = Math.min(100, Math.max(1, limit || 50));

    const connection = socketConnections[socket.id];
    if (!connection) {
      socket.emit("chat-error", { message: "Not connected to a room" });
      return;
    }

    // Get meeting
    const meeting = await prisma.meeting.findUnique({
      where: { roomId },
      select: { id: true },
    });

    if (!meeting) {
      socket.emit("chat-error", { message: "Meeting not found" });
      return;
    }

    // Get chat history
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
        createdAt: "desc",
      },
      take: validatedLimit,
    });

    // Reverse to show oldest first
    const chatHistory = messages.reverse().map((msg) => ({
      id: msg.id,
      userId: msg.userId,
      userName: msg.user.name,
      message: msg.message,
      createdAt: msg.createdAt,
    }));

    socket.emit("chat-history", {
      roomId,
      messages: chatHistory,
    });
  } catch (error) {
    console.error("Error getting chat history:", error);
    socket.emit("chat-error", { message: "Failed to get chat history" });
  }
}

async function handleDeleteMessage(
  io: Server,
  socket: Socket,
  messageId: string
): Promise<void> {
  try {
    const connection = socketConnections[socket.id];
    if (!connection) {
      socket.emit("chat-error", { message: "Not connected to a room" });
      return;
    }

    // Get the message
    const chatMessage = await prisma.chatMessage.findUnique({
      where: { id: messageId },
      include: {
        meeting: true,
        user: true,
      },
    });

    if (!chatMessage) {
      socket.emit("chat-error", { message: "Message not found" });
      return;
    }

    // Verify user is host or message owner
    const participant = await prisma.meetingParticipant.findUnique({
      where: {
        userId_meetingId: {
          userId: connection.userId,
          meetingId: connection.meetingDbId,
        },
      },
      select: { isHost: true },
    });

    const isHost = participant?.isHost === true;
    const isOwner = chatMessage.userId === connection.userId;

    if (!isHost && !isOwner) {
      socket.emit("chat-error", { message: "Not authorized to delete this message" });
      return;
    }

    // Delete message
    await prisma.chatMessage.delete({
      where: { id: messageId },
    });

    // Notify all participants
    io.to(connection.roomId).emit("message-deleted", {
      messageId,
      roomId: connection.roomId,
    });

    console.log(`Message ${messageId} deleted by ${connection.name}`);
  } catch (error) {
    console.error("Error deleting message:", error);
    socket.emit("chat-error", { message: "Failed to delete message" });
  }
}

