import type { Request, Response, NextFunction } from "express";
import { verifyToken } from "../../utils/auth.js";
import { prisma } from "../../lib/prisma.js";
import type { AuthRequest } from "../../middleware/auth.js";
import { asyncHandler } from "../../middleware/errorHandler.js";

export interface AdminRequest extends AuthRequest {
  admin?: {
    userId: string;
    email?: string;
    name: string;
    isAdmin: boolean;
    isMainAdmin?: boolean;
    role?: string;
  };
}

/**
 * Middleware to verify admin access
 * Requires authentication AND isAdmin = true
 */
export const requireAdmin = asyncHandler(
  async (req: AdminRequest, res: Response, next: NextFunction): Promise<void> => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      res.status(401).json({ error: "No token provided" });
      return;
    }

    const token = authHeader.substring(7);
    const payload = verifyToken(token);

    if (!payload) {
      console.error("[AdminAuth] Token verification failed");
      res.status(401).json({ error: "Invalid or expired token" });
      return;
    }

    console.log("[AdminAuth] Token verified, userId:", payload.userId);

    // Check if admin exists in Admin table
    const admin = await prisma.admin.findUnique({
      where: { id: payload.userId },
      select: { id: true, name: true, email: true, role: true, isActive: true },
    });

    if (!admin) {
      console.error("[AdminAuth] Admin not found for userId:", payload.userId);
      console.error("[AdminAuth] Token payload:", JSON.stringify(payload, null, 2));
      // List all admins for debugging
      const allAdmins = await prisma.admin.findMany({ select: { id: true, email: true } });
      console.error("[AdminAuth] Available admins:", JSON.stringify(allAdmins, null, 2));
      res.status(403).json({ 
        error: "Admin access required",
        details: "The token's userId does not match any admin in the database. Please log out and log in again."
      });
      return;
    }

    if (!admin.isActive) {
      res.status(403).json({ 
        error: "Admin account is deactivated",
        details: "Your admin account has been deactivated. Please contact the main admin."
      });
      return;
    }

    console.log("[AdminAuth] Admin authenticated:", admin.email, "Role:", admin.role);

    req.admin = {
      userId: admin.id,
      email: admin.email,
      name: admin.name,
      isAdmin: true,
      isMainAdmin: admin.role === "MAIN_ADMIN",
      role: admin.role,
    };

    req.user = payload; // Also set user for compatibility
    next();
  }
);

