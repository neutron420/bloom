// In-memory tracking for active socket connections
// socketId -> { roomId, meetingDbId, userId, name }
export const socketConnections: Record<string, { 
  roomId: string; 
  meetingDbId: string; 
  userId: string; 
  name: string 
}> = {};

// roomId -> { socketId -> name } (for quick participant lookup)
export const rooms: Record<string, Record<string, string>> = {};

// Debounce participant list updates to reduce database load
export const participantUpdateQueue = new Map<string, NodeJS.Timeout>();

// Rate limiting: track join attempts per socket
export const joinAttempts = new Map<string, { count: number; resetAt: number }>();

