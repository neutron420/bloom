import { z } from "zod";
import type { Request, Response, NextFunction } from "express";

export function validate(schema: z.ZodSchema) {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      schema.parse(req.body);
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({
          error: "Validation error",
          details: error.errors,
        });
        return;
      }
      next(error);
    }
  };
}

// Common validation schemas
export const roomIdSchema = z.object({
  roomId: z.string().min(1).max(100),
});

export const messageSchema = z.object({
  message: z.string().min(1).max(1000),
});

export const joinRoomSchema = z.object({
  roomId: z.string().min(1).max(100),
  name: z.string().min(1).max(100),
  email: z.string().email().optional(),
});

