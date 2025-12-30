import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";

const JWT_SECRET: string = process.env.JWT_SECRET || "your-secret-key-change-in-production";
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "7d";

export interface JWTPayload {
  userId: string;
  email?: string;
  name: string;
}

export function generateToken(payload: JWTPayload): string {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret === "your-secret-key-change-in-production") {
    throw new Error("JWT_SECRET must be set");
  }
  // @ts-ignore - JWT types are strict but this is valid
  return jwt.sign(payload, secret, {
    expiresIn: JWT_EXPIRES_IN,
  });
}

export function verifyToken(token: string): JWTPayload | null {
  try {
    const secret = process.env.JWT_SECRET;
    if (!secret || secret === "your-secret-key-change-in-production") {
      console.error("[Auth] JWT_SECRET not set or using default");
      return null;
    }
    return jwt.verify(token, secret) as JWTPayload;
  } catch (error: any) {
    console.error("[Auth] Token verification error:", error.message);
    return null;
  }
}

export async function hashPassword(password: string): Promise<string> {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
}

export async function comparePassword(password: string, hashedPassword: string): Promise<boolean> {
  return bcrypt.compare(password, hashedPassword);
}

