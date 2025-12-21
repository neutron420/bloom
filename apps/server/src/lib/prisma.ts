import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env file manually
try {
  const envPath = join(__dirname, "../../.env");
  const envFile = readFileSync(envPath, "utf8");
  envFile.split("\n").forEach((line) => {
    const trimmedLine = line.trim();
    if (trimmedLine && !trimmedLine.startsWith("#")) {
      const match = trimmedLine.match(/^([^=]+)=(.*)$/);
      if (match && match[1] && match[2]) {
        const key = match[1].trim();
        let value = match[2].trim();
        // Remove quotes if present
        if (
          (value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))
        ) {
          value = value.slice(1, -1);
        }
        if (!process.env[key]) {
          process.env[key] = value;
        }
      }
    }
  });
} catch (error) {
  // Logger not available here yet, use console.warn
  if (process.env.NODE_ENV !== "production") {
    console.warn("Could not load .env file, using system environment variables");
  }
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL environment variable is required");
}

// Optimized connection pool for high concurrency
// Increased pool size for handling numerous concurrent requests
const pool = new Pool({
  connectionString,
  max: 50, // Increased from 20 to handle more concurrent requests
  min: 10, // Increased from 5 to maintain more ready connections
  idleTimeoutMillis: 30000, // Close idle clients after 30 seconds
  connectionTimeoutMillis: 5000, // Increased to 5 seconds for better reliability
  allowExitOnIdle: false, // Keep pool alive
});

const adapter = new PrismaPg(pool);

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter,
    log: ["query", "error", "warn"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

