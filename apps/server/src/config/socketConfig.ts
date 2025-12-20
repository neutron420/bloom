import { Server } from "socket.io";
import { Server as HttpServer } from "http";

export function createSocketIO(server: HttpServer): Server {
  return new Server(server, {
    cors: { origin: "*" },
    pingTimeout: 60000, // Increase timeout for large rooms
    pingInterval: 25000,
    maxHttpBufferSize: 1e6, // 1MB
    transports: ["websocket", "polling"], // Support both transports
    allowEIO3: true, // Backward compatibility
  });
}

