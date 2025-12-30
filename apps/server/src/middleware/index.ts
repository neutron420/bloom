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

  // CORS - Allow admin frontend and main frontend
  const allowedOrigins = [
    "http://localhost:3000",  // Main frontend
    "http://localhost:3003",  // Admin frontend
    process.env.FRONTEND_URL,
    process.env.ADMIN_FRONTEND_URL,
  ].filter(Boolean) as string[];

  app.use(cors({
    origin: (origin, callback) => {
      // In development, allow all localhost origins
      if (process.env.NODE_ENV === "development") {
        if (!origin || origin.includes("localhost") || origin.includes("127.0.0.1")) {
          return callback(null, true);
        }
      }
      
      // Allow requests with no origin (like mobile apps or curl requests)
      if (!origin) {
        return callback(null, true);
      }
      
      // Check if origin is in allowed list
      if (allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
    exposedHeaders: ["Content-Type", "Authorization"],
  }));

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

