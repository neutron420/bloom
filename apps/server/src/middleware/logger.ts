import type { Request, Response, NextFunction } from "express";
import { logger } from "../utils/logger.js";

export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const start = Date.now();

  // Log request
  logger.http(`${req.method} ${req.path}`, {
    ip: req.ip || req.socket.remoteAddress,
    userAgent: req.get("user-agent"),
    ...(req.body && Object.keys(req.body).length > 0 && { body: req.body }),
    ...(req.query && Object.keys(req.query).length > 0 && { query: req.query }),
  });

  // Log response when finished
  res.on("finish", () => {
    const duration = Date.now() - start;
    const logLevel = res.statusCode >= 500 ? "error" : res.statusCode >= 400 ? "warn" : "info";
    
    logger[logLevel](`${req.method} ${req.path} - ${res.statusCode} - ${duration}ms`, {
      statusCode: res.statusCode,
      duration: `${duration}ms`,
    });
  });

  next();
}

