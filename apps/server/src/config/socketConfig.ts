import { Server } from "socket.io";
import { Server as HttpServer } from "http";
import { optionalSocketAuthMiddleware } from "../middleware/socketAuth.js";
import { logger } from "../utils/logger.js";

export function createSocketIO(server: HttpServer): Server {
  const io = new Server(server, {
    cors: { origin: "*" },
    pingTimeout: 60000, // Increase timeout for large rooms
    pingInterval: 25000,
    maxHttpBufferSize: 1e6, // 1MB
    transports: ["websocket", "polling"], // Support both transports
    allowEIO3: true, // Backward compatibility
  });

  // Apply optional authentication middleware
  // This allows connections but attaches user info if token is provided
  // For stricter auth, use socketAuthMiddleware instead
  io.use(optionalSocketAuthMiddleware);

  logger.info("Socket.IO server configured with authentication middleware");

  return io;
}

