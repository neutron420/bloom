import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { generateToken, hashPassword, comparePassword } from "../utils/auth.js";
import { authenticate } from "../middleware/auth.js";
import type { AuthRequest } from "../middleware/auth.js";
import { asyncHandler } from "../middleware/errorHandler.js";
import { z } from "zod";
import { OAuth2Client } from "google-auth-library";

const router = Router();

// Validation schemas
const registerSchema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email().optional(),
  password: z.string().min(6).max(100),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const guestLoginSchema = z.object({
  name: z.string().min(1).max(100),
});

const googleAuthSchema = z.object({
  token: z.string().min(1),
});

// Initialize Google OAuth client
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

/**
 * @swagger
 * /api/auth/register:
 *   post:
 *     summary: Register a new user
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - password
 *             properties:
 *               name:
 *                 type: string
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *                 minLength: 6
 *     responses:
 *       201:
 *         description: User registered successfully
 *       400:
 *         description: Validation error
 */
router.post("/register", asyncHandler(async (req, res) => {
  const validated = registerSchema.parse(req.body);
  const { name, email, password } = validated;

  // Check if user exists
  if (email) {
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return res.status(400).json({ error: "User with this email already exists" });
    }
  }

  // Hash password
  const hashedPassword = await hashPassword(password);

  // Create user
  const user = await prisma.user.create({
    data: {
      name,
      email: email || null,
      password: hashedPassword,
    },
    select: {
      id: true,
      name: true,
      email: true,
      createdAt: true,
    },
  });

  // Generate token
  const token = generateToken({
    userId: user.id,
    ...(user.email && { email: user.email }),
    name: user.name,
  });

  res.status(201).json({
    message: "User registered successfully",
    user,
    token,
  });
}));

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: Login with email and password
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Login successful
 *       401:
 *         description: Invalid credentials
 */
router.post("/login", asyncHandler(async (req, res) => {
  const validated = loginSchema.parse(req.body);
  const { email, password } = validated;

  // Find user
  const user = await prisma.user.findUnique({
    where: { email },
  });

  if (!user || !user.password) {
    return res.status(401).json({ error: "Invalid credentials" });
  }

  // Verify password
  const isValid = await comparePassword(password, user.password);
  if (!isValid) {
    return res.status(401).json({ error: "Invalid credentials" });
  }

  // Generate token
  const token = generateToken({
    userId: user.id,
    ...(user.email && { email: user.email }),
    name: user.name,
  });

  res.json({
    message: "Login successful",
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
    },
    token,
  });
}));

/**
 * @swagger
 * /api/auth/guest:
 *   post:
 *     summary: Guest login (no password required)
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *             properties:
 *               name:
 *                 type: string
 *     responses:
 *       200:
 *         description: Guest login successful
 */
router.post("/guest", asyncHandler(async (req, res) => {
  const validated = guestLoginSchema.parse(req.body);
  const { name } = validated;

  // Get or create guest user
  let user = await prisma.user.findFirst({
    where: {
      name,
      email: null,
      password: null,
    },
  });

  if (!user) {
    user = await prisma.user.create({
      data: { name },
    });
  }

  // Generate token
  const token = generateToken({
    userId: user.id,
    name: user.name,
  });

  res.json({
    message: "Guest login successful",
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
    },
    token,
  });
}));

/**
 * @swagger
 * /api/auth/google:
 *   post:
 *     summary: Authenticate with Google OAuth
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - token
 *             properties:
 *               token:
 *                 type: string
 *                 description: Google ID token from client
 *     responses:
 *       200:
 *         description: Google authentication successful
 *       401:
 *         description: Invalid Google token
 */
router.post("/google", asyncHandler(async (req, res) => {
  const validated = googleAuthSchema.parse(req.body);
  const { token } = validated;

  try {
    // Verify the Google token
    const ticket = await googleClient.verifyIdToken({
      idToken: token,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    if (!payload) {
      return res.status(401).json({ error: "Invalid Google token" });
    }

    const { sub: googleId, email, name, picture } = payload;

    if (!email || !name) {
      return res.status(400).json({ error: "Missing required user information from Google" });
    }

    // Find or create user
    let user = await prisma.user.findFirst({
      where: {
        OR: [
          { googleId },
          { email },
        ],
      },
    });

    if (user) {
      // Update user if they logged in with email before and now using Google
      if (!user.googleId && googleId) {
        user = await prisma.user.update({
          where: { id: user.id },
          data: {
            googleId,
            profilePicture: picture || null,
          },
        });
      } else if (user.googleId && picture && user.profilePicture !== picture) {
        // Update profile picture if changed
        user = await prisma.user.update({
          where: { id: user.id },
          data: { profilePicture: picture },
        });
      }
    } else {
      // Create new user
      user = await prisma.user.create({
        data: {
          name,
          email,
          googleId,
          profilePicture: picture || null,
        },
      });
    }

    // Generate token
    const jwtToken = generateToken({
      userId: user.id,
      ...(user.email && { email: user.email }),
      name: user.name,
    });

    res.json({
      message: "Google authentication successful",
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        profilePicture: user.profilePicture,
      },
      token: jwtToken,
    });
  } catch (error) {
    console.error("Google auth error:", error);
    res.status(401).json({ error: "Invalid Google token" });
  }
}));

/**
 * @swagger
 * /api/auth/me:
 *   get:
 *     summary: Get current user info
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User information
 *       401:
 *         description: Unauthorized
 */
router.get("/me", authenticate, asyncHandler(async (req: AuthRequest, res) => {
  if (!req.user) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const user = await prisma.user.findUnique({
    where: { id: req.user.userId },
    select: {
      id: true,
      name: true,
      email: true,
      profilePicture: true,
      createdAt: true,
    },
  });

  if (!user) {
    return res.status(404).json({ error: "User not found" });
  }

  res.json({ user });
}));

export default router;

