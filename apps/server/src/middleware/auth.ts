import type { Request, Response, NextFunction } from "express";
import { verifyToken } from "../utils/auth.js";

export interface AuthRequest extends Request {
  user?: {
    userId: string;
    email?: string;
    name: string;
  };
}

export function authenticate(req: AuthRequest, res: Response, next: NextFunction): void {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      res.status(401).json({ error: "No token provided" });
      return;
    }

    const token = authHeader.substring(7); // Remove "Bearer " prefix
    const payload = verifyToken(token);

    if (!payload) {
      res.status(401).json({ error: "Invalid or expired token" });
      return;
    }

    req.user = payload;
    next();
  } catch (error) {
    res.status(401).json({ error: "Authentication failed" });
  }
}

export function optionalAuth(req: AuthRequest, res: Response, next: NextFunction): void {
  try {
    const authHeader = req.headers.authorization;

    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.substring(7);
      const payload = verifyToken(token);
      if (payload) {
        req.user = payload;
      }
    }

    next();
  } catch (error) {
    next();
  }
}

