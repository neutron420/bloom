import type { Socket } from "socket.io";
import type { ExtendedError } from "socket.io/dist/namespace";
import { verifyToken } from "../utils/auth.js";
import { logger } from "../utils/logger.js";

export interface AuthenticatedSocket extends Socket {
  userId?: string;
  userEmail?: string;
  userName?: string;
}

/**
 * Socket.IO authentication middleware
 * Validates JWT token from handshake auth or query params
 */
export function socketAuthMiddleware(socket: AuthenticatedSocket, next: (err?: ExtendedError) => void): void {
  try {
    // Try to get token from handshake auth (preferred method)
    const token = socket.handshake.auth?.token || socket.handshake.query?.token;

    if (!token || typeof token !== "string") {
      logger.warn(`Socket connection rejected: No token provided`, {
        socketId: socket.id,
        ip: socket.handshake.address,
      });
      return next(new Error("Authentication required"));
    }

    // Verify the token
    const payload = verifyToken(token);
    if (!payload) {
      logger.warn(`Socket connection rejected: Invalid token`, {
        socketId: socket.id,
        ip: socket.handshake.address,
      });
      return next(new Error("Invalid authentication token"));
    }

    // Attach user info to socket
    socket.userId = payload.userId;
    socket.userEmail = payload.email;
    socket.userName = payload.name;

    logger.info(`Socket authenticated`, {
      socketId: socket.id,
      userId: payload.userId,
      userName: payload.name,
      ip: socket.handshake.address,
    });

    next();
  } catch (error) {
    logger.error(`Socket authentication error`, {
      socketId: socket.id,
      error: error instanceof Error ? error.message : String(error),
      ip: socket.handshake.address,
    });
    next(new Error("Authentication failed"));
  }
}

/**
 * Optional authentication - allows connection but attaches user info if token is valid
 */
export function optionalSocketAuthMiddleware(socket: AuthenticatedSocket, next: (err?: ExtendedError) => void): void {
  try {
    const token = socket.handshake.auth?.token || socket.handshake.query?.token;

    if (token && typeof token === "string") {
      const payload = verifyToken(token);
      if (payload) {
        socket.userId = payload.userId;
        socket.userEmail = payload.email;
        socket.userName = payload.name;
        logger.debug(`Socket optionally authenticated`, {
          socketId: socket.id,
          userId: payload.userId,
        });
      }
    }

    next();
  } catch (error) {
    // Don't block connection on optional auth failure
    logger.debug(`Optional socket auth failed, allowing connection`, {
      socketId: socket.id,
      error: error instanceof Error ? error.message : String(error),
    });
    next();
  }
}

