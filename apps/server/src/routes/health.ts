import { Router } from "express";
import { socketConnections, rooms } from "../store/connectionStore.js";
import { MAX_CONNECTIONS_PER_ROOM, MAX_TOTAL_CONNECTIONS, MAX_ROOMS } from "../config/constants.js";

const router = Router();

// Root endpoint
router.get("/", (req, res) => {
  res.json({
    message: "Bloom Meeting Backend API",
    version: "1.0.0",
    status: "running",
    endpoints: {
      health: "/health",
      stats: "/api/stats",
      users: "/api/users",
      meetings: "/api/meetings",
      meetingSettings: "/api/meetings/:roomId/settings",
    },
    socket: {
      port: 3001,
      events: [
        "join-room",
        "request-join",
        "approve-request",
        "decline-request",
        "get-pending-requests",
      ],
    },
  });
});

router.get("/health", (req, res) => {
  const totalConnections = Object.keys(socketConnections).length;
  const activeRooms = Object.keys(rooms).length;
  const roomStats = Object.entries(rooms).map(([roomId, participants]) => ({
    roomId,
    participantCount: Object.keys(participants).length,
  }));

  const largestRoom = roomStats.reduce((max, room) => 
    room.participantCount > max.participantCount ? room : max, 
    { roomId: "none", participantCount: 0 }
  );

  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: {
      used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + " MB",
      total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024) + " MB",
      rss: Math.round(process.memoryUsage().rss / 1024 / 1024) + " MB",
    },
    connections: {
      active: totalConnections,
      max: MAX_TOTAL_CONNECTIONS,
      percentage: Math.round((totalConnections / MAX_TOTAL_CONNECTIONS) * 100),
    },
    rooms: {
      active: activeRooms,
      max: MAX_ROOMS,
      largest: largestRoom,
    },
    limits: {
      maxPerRoom: MAX_CONNECTIONS_PER_ROOM,
      maxTotal: MAX_TOTAL_CONNECTIONS,
      maxRooms: MAX_ROOMS,
    },
  });
});

router.get("/stats", (req, res) => {
  const roomStats = Object.entries(rooms)
    .map(([roomId, participants]) => ({
      roomId,
      participantCount: Object.keys(participants).length,
    }))
    .sort((a, b) => b.participantCount - a.participantCount);

  const totalConnections = Object.keys(socketConnections).length;
  const activeRooms = Object.keys(rooms).length;
  
  const avgParticipantsPerRoom = activeRooms > 0 
    ? Math.round(totalConnections / activeRooms) 
    : 0;
  
  const largestRoom = roomStats[0] || { roomId: "none", participantCount: 0 };

  res.set("Cache-Control", "public, max-age=5");
  
  res.json({
    timestamp: new Date().toISOString(),
    summary: {
      totalRooms: activeRooms,
      totalConnections,
      avgParticipantsPerRoom,
      largestRoom,
    },
    limits: {
      maxPerRoom: MAX_CONNECTIONS_PER_ROOM,
      maxTotal: MAX_TOTAL_CONNECTIONS,
      maxRooms: MAX_ROOMS,
      usage: {
        connections: Math.round((totalConnections / MAX_TOTAL_CONNECTIONS) * 100) + "%",
        rooms: Math.round((activeRooms / MAX_ROOMS) * 100) + "%",
      },
    },
    rooms: roomStats,
  });
});

export default router;

