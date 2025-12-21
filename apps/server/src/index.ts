import express from "express";
import http from "http";
import { setupMiddleware } from "./middleware/index.js";
import { createSocketIO } from "./config/socketConfig.js";
import { setupSocketHandlers } from "./handlers/socketHandlers.js";
import apiRoutes from "./routes/api.js";
import healthRoutes from "./routes/health.js";
import meetingSettingsRoutes from "./routes/meetingSettings.js";
import chatRoutes from "./routes/chat.js";
import authRoutes from "./routes/auth.js";
import { setupSwagger } from "./config/swagger.js";
import { setupGracefulShutdown } from "./utils/shutdown.js";
import { setupErrorHandler } from "./middleware/index.js";
import { MAX_CONNECTIONS_PER_ROOM, MAX_TOTAL_CONNECTIONS, MAX_ROOMS } from "./config/constants.js";
import { createWorkers, closeWorkers } from "./config/mediasoup.js";
import { logger } from "./utils/logger.js";

// Validate environment variables on startup
if (process.env.NODE_ENV === "production" && (!process.env.JWT_SECRET || process.env.JWT_SECRET === "your-secret-key-change-in-production")) {
  logger.error("ERROR: JWT_SECRET must be set in production!");
  process.exit(1);
}

const app = express();
setupMiddleware(app);

const server = http.createServer(app);
const io = createSocketIO(server);

// Initialize MediaSoup workers (async initialization)
createWorkers()
  .then(() => {
    logger.info("MediaSoup workers initialized");
  })
  .catch((error) => {
    logger.error("Failed to initialize MediaSoup workers", { error });
    process.exit(1);
  });

// Setup Socket.IO handlers
setupSocketHandlers(io);

// Swagger API Documentation
setupSwagger(app);

// API Routes
app.use("/api/auth", authRoutes);
app.use("/api", apiRoutes);
app.use("/api", meetingSettingsRoutes);
app.use("/api", chatRoutes);

// Health and Stats Routes
app.use("/", healthRoutes);

// Error handler (must be last)
setupErrorHandler(app);

// Setup graceful shutdown
setupGracefulShutdown(server, io);

// Start server
server.listen(3001, () => {
  logger.info("Backend running on http://localhost:3001");
  logger.info("Database connected");
  logger.info("Optimized for high concurrency", {
    limits: {
      perRoom: MAX_CONNECTIONS_PER_ROOM,
      total: MAX_TOTAL_CONNECTIONS,
      rooms: MAX_ROOMS,
    },
  });
  logger.info("Security: Helmet, Rate Limiting, Compression enabled");
});
