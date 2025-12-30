import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { hashPassword } from "../src/utils/auth.js";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env file manually - check multiple possible locations
const possibleEnvPaths = [
  join(__dirname, "../.env"),           // apps/server/.env
  join(__dirname, "../../.env"),       // root/.env
  join(__dirname, "../../../.env"),     // if scripts is nested
];

let envLoaded = false;
for (const envPath of possibleEnvPaths) {
  try {
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
    envLoaded = true;
    console.log(`Loaded .env file from: ${envPath}`);
    break;
  } catch (error) {
    // Try next path
    continue;
  }
}

if (!envLoaded) {
  console.warn(" Could not find .env file in common locations, using system environment variables");
  console.warn("   Checked paths:");
  possibleEnvPaths.forEach(path => console.warn(`   - ${path}`));
}

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error(" ERROR: DATABASE_URL environment variable is required!");
  console.error("Please set DATABASE_URL in your .env file or environment variables.");
  process.exit(1);
}

const pool = new Pool({
  connectionString,
  max: 10,
  min: 2,
});

const adapter = new PrismaPg(pool);

const prisma = new PrismaClient({
  adapter,
  log: ["error", "warn"],
});

async function createAdmin() {
  const email = process.env.ADMIN_EMAIL || "admin@example.com";
  const password = process.env.ADMIN_PASSWORD || "admin123";
  const name = process.env.ADMIN_NAME || "Admin User";

  try {
    // Check if admin already exists
    const existingAdmin = await prisma.admin.findUnique({
      where: { email },
    });

    if (existingAdmin) {
      // Update existing admin password
      const hashedPassword = await hashPassword(password);
      const updatedAdmin = await prisma.admin.update({
        where: { email },
        data: {
          password: hashedPassword,
          name: name, // Update name if changed
        },
      });
      console.log("Updated existing admin:");
      console.log(`   Email: ${updatedAdmin.email}`);
      console.log(`   Name: ${updatedAdmin.name}`);
      console.log(`   Password: ${password}`);
    } else {
      // Create new admin (super admin by default)
      const hashedPassword = await hashPassword(password);
      const newAdmin = await prisma.admin.create({
        data: {
          email,
          name,
          password: hashedPassword,
          role: "SUPER_ADMIN",
          isActive: true,
        },
      });
      console.log(" Created new admin:");
      console.log(`   Email: ${newAdmin.email}`);
      console.log(`   Name: ${newAdmin.name}`);
      console.log(`   Password: ${password}`);
    }

    console.log("\n🎉 Admin user ready!");
    console.log(`\nYou can now login at: http://localhost:3003/login`);
    console.log(`Email: ${email}`);
    console.log(`Password: ${password}`);
  } catch (error) {
    console.error("❌ Error creating admin:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

createAdmin();

