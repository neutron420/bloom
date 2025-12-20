import express from "express";
import cors from "cors";
import compression from "compression";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { requestLogger } from "./logger.js";
import { errorHandler } from "./errorHandler.js";

export function setupMiddleware(app: express.Application): void {
  // Request logging (before other middleware)
  app.use(requestLogger);

  // Security headers
  app.use(helmet({
    contentSecurityPolicy: false, // Allow Socket.IO connections
  }));

  // Compression for API responses
  app.use(compression());

  // CORS
  app.use(cors());

  // Body parsing with size limits
  app.use(express.json({ limit: "10mb" }));
  app.use(express.urlencoded({ extended: true, limit: "10mb" }));

  // Rate limiting for API endpoints
  const apiLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 100, // Limit each IP to 100 requests per windowMs
    message: "Too many requests from this IP, please try again later.",
    standardHeaders: true,
    legacyHeaders: false,
  });

  app.use("/api/", apiLimiter);
}

// Error handler must be last
export function setupErrorHandler(app: express.Application): void {
  app.use(errorHandler);
}

