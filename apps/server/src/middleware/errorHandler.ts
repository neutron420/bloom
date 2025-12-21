import type { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";
import { logger } from "../utils/logger.js";

export interface AppError extends Error {
  statusCode?: number;
  isOperational?: boolean;
}

export function errorHandler(
  err: AppError | Error,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // Log error for debugging
  logger.error("Request error", {
    message: err.message,
    stack: process.env.NODE_ENV === "development" ? err.stack : undefined,
    path: req.path,
    method: req.method,
    statusCode: "statusCode" in err ? err.statusCode : 500,
  });

  // Handle Zod validation errors
  if (err instanceof ZodError) {
    res.status(400).json({
      error: "Validation error",
      details: err.errors,
    });
    return;
  }

  // Handle Prisma errors (check by name for compatibility)
  if (err.name === "PrismaClientKnownRequestError") {
    const prismaError = err as { code?: string; meta?: any };
    if (prismaError.code === "P2002") {
      res.status(409).json({
        error: "Duplicate entry",
        message: "A record with this value already exists",
      });
      return;
    }
    if (prismaError.code === "P2025") {
      res.status(404).json({
        error: "Not found",
        message: "The requested record was not found",
      });
      return;
    }
    // Log other Prisma errors
    logger.error("Prisma error", { code: prismaError.code, meta: prismaError.meta });
  }

  // Handle custom application errors
  if ("statusCode" in err && err.statusCode) {
    res.status(err.statusCode).json({
      error: err.message || "An error occurred",
    });
    return;
  }

  // Default error response
  const statusCode = "statusCode" in err && err.statusCode ? err.statusCode : 500;
  res.status(statusCode).json({
    error: process.env.NODE_ENV === "production" 
      ? "Internal server error" 
      : err.message,
    ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
  });
}

// Async error wrapper
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<any>
) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

// Create custom error
export function createError(message: string, statusCode: number = 500): AppError {
  const error = new Error(message) as AppError;
  error.statusCode = statusCode;
  error.isOperational = true;
  return error;
}

