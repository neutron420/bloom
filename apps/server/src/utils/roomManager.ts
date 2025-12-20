import { rooms, socketConnections, participantUpdateQueue } from "../store/connectionStore.js";
import { MAX_CONNECTIONS_PER_ROOM, MAX_TOTAL_CONNECTIONS, MAX_ROOMS, PARTICIPANT_UPDATE_DEBOUNCE_MS } from "../config/constants.js";
import { Server } from "socket.io";

export function getRoomSize(roomId: string): number {
  return rooms[roomId] ? Object.keys(rooms[roomId]).length : 0;
}

export function canJoinRoom(roomId: string): { allowed: boolean; reason?: string } {
  // Check global connection limit
  const totalConnections = Object.keys(socketConnections).length;
  if (totalConnections >= MAX_TOTAL_CONNECTIONS) {
    return { allowed: false, reason: "Server at maximum capacity" };
  }

  // Check room limit
  const roomSize = getRoomSize(roomId);
  if (roomSize >= MAX_CONNECTIONS_PER_ROOM) {
    return { allowed: false, reason: `Room is full (max ${MAX_CONNECTIONS_PER_ROOM} users)` };
  }

  // Check total rooms limit (only for new rooms)
  if (!rooms[roomId] && Object.keys(rooms).length >= MAX_ROOMS) {
    return { allowed: false, reason: "Maximum number of rooms reached" };
  }

  return { allowed: true };
}

// Batch participant updates (wait before updating)
export function scheduleParticipantUpdate(roomId: string, updateFn: () => void): void {
  const existing = participantUpdateQueue.get(roomId);
  if (existing) {
    clearTimeout(existing);
  }
  
  const timeout = setTimeout(() => {
    updateFn();
    participantUpdateQueue.delete(roomId);
  }, PARTICIPANT_UPDATE_DEBOUNCE_MS);
  
  participantUpdateQueue.set(roomId, timeout);
}

export function broadcastParticipants(io: Server, roomId: string): void {
  scheduleParticipantUpdate(roomId, () => {
    const room = rooms[roomId];
    if (room) {
      const currentList = Object.values(room);
      io.to(roomId).emit("participants", currentList);
      console.log(`Broadcasted participants list to room ${roomId}: ${currentList.length} participants`);
    }
  });
}

