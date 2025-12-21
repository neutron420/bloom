import { Server as HttpServer } from "http";
import { Server as SocketIOServer } from "socket.io";
import { prisma } from "../lib/prisma.js";
import { closeWorkers } from "../config/mediasoup.js";
import { logger } from "./logger.js";

export function setupGracefulShutdown(
  server: HttpServer,
  io: SocketIOServer
): void {
  const gracefulShutdown = async (signal: string) => {
    logger.info(`${signal} received. Starting graceful shutdown...`);
    
    // Stop accepting new connections
    server.close(() => {
      logger.info("HTTP server closed");
    });

    // Close Socket.IO connections
    io.close(() => {
      logger.info("Socket.IO server closed");
    });

    // Disconnect all sockets
    io.disconnectSockets(true);
    logger.info("All socket connections closed");

    // Close MediaSoup workers
    try {
      await closeWorkers();
      logger.info("MediaSoup workers closed");
    } catch (error) {
      logger.error("Error closing MediaSoup workers", { error });
    }

    // Close database connections
    try {
      await prisma.$disconnect();
      logger.info("Database connections closed");
    } catch (error) {
      logger.error("Error closing database", { error });
    }

    logger.info("Graceful shutdown complete");
    process.exit(0);
  };

  // Handle shutdown signals
  process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
  process.on("SIGINT", () => gracefulShutdown("SIGINT"));

  // Handle uncaught errors
  process.on("uncaughtException", (error) => {
    logger.error("Uncaught Exception", { error, stack: error.stack });
    gracefulShutdown("uncaughtException");
  });

  process.on("unhandledRejection", (reason, promise) => {
    logger.error("Unhandled Rejection", { reason, promise });
    // Don't exit on unhandled rejection, just log it
  });
}

