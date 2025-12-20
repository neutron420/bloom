import { Server as HttpServer } from "http";
import { Server as SocketIOServer } from "socket.io";
import { prisma } from "../lib/prisma.js";

export function setupGracefulShutdown(
  server: HttpServer,
  io: SocketIOServer
): void {
  const gracefulShutdown = async (signal: string) => {
    console.log(`\n${signal} received. Starting graceful shutdown...`);
    
    // Stop accepting new connections
    server.close(() => {
      console.log("HTTP server closed");
    });

    // Close Socket.IO connections
    io.close(() => {
      console.log("Socket.IO server closed");
    });

    // Disconnect all sockets
    io.disconnectSockets(true);
    console.log("All socket connections closed");

    // Close database connections
    try {
      await prisma.$disconnect();
      console.log("Database connections closed");
    } catch (error) {
      console.error("Error closing database:", error);
    }

    console.log("Graceful shutdown complete");
    process.exit(0);
  };

  // Handle shutdown signals
  process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
  process.on("SIGINT", () => gracefulShutdown("SIGINT"));

  // Handle uncaught errors
  process.on("uncaughtException", (error) => {
    console.error("Uncaught Exception:", error);
    gracefulShutdown("uncaughtException");
  });

  process.on("unhandledRejection", (reason, promise) => {
    console.error("Unhandled Rejection at:", promise, "reason:", reason);
    // Don't exit on unhandled rejection, just log it
  });
}

