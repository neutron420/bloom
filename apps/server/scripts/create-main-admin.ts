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
  join(__dirname, "../../.env"),        // root/.env
  join(__dirname, "../../../.env"),    // if scripts is nested
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
    console.log(`✅ Loaded .env file from: ${envPath}`);
    break;
  } catch (error) {
    // Try next path
    continue;
  }
}

if (!envLoaded) {
  console.warn("⚠️  Could not find .env file in common locations, using system environment variables");
  console.warn("   Checked paths:");
  possibleEnvPaths.forEach(path => console.warn(`   - ${path}`));
}

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error("❌ ERROR: DATABASE_URL environment variable is required!");
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

async function createMainAdmin() {
  const email = process.env.MAIN_ADMIN_EMAIL || "mainadmin@example.com";
  const password = process.env.MAIN_ADMIN_PASSWORD || "mainadmin123";
  const name = process.env.MAIN_ADMIN_NAME || "Main Admin";

  try {
    // Check if main admin already exists
    const existingMainAdmin = await prisma.admin.findFirst({
      where: { role: "MAIN_ADMIN" },
    });

    if (existingMainAdmin) {
      // Update existing main admin password
      const hashedPassword = await hashPassword(password);
      const updatedAdmin = await prisma.admin.update({
        where: { id: existingMainAdmin.id },
        data: {
          password: hashedPassword,
          name: name,
        },
      });
      console.log("✅ Updated existing main admin:");
      console.log(`   Email: ${updatedAdmin.email}`);
      console.log(`   Name: ${updatedAdmin.name}`);
      console.log(`   Password: ${password}`);
    } else {
      // Check if admin with this email exists
      const existingAdmin = await prisma.admin.findUnique({
        where: { email },
      });

      if (existingAdmin) {
        // Update to main admin
        const hashedPassword = await hashPassword(password);
        const updatedAdmin = await prisma.admin.update({
          where: { id: existingAdmin.id },
          data: {
            role: "MAIN_ADMIN",
            password: hashedPassword,
            name: name,
            isActive: true,
          },
        });
        console.log("✅ Updated admin to main admin:");
        console.log(`   Email: ${updatedAdmin.email}`);
        console.log(`   Name: ${updatedAdmin.name}`);
        console.log(`   Password: ${password}`);
      } else {
        // Create new main admin
        const hashedPassword = await hashPassword(password);
        const newAdmin = await prisma.admin.create({
          data: {
            email,
            name,
            password: hashedPassword,
            role: "MAIN_ADMIN",
            isActive: true,
          },
        });
        console.log("✅ Created new main admin:");
        console.log(`   Email: ${newAdmin.email}`);
        console.log(`   Name: ${newAdmin.name}`);
        console.log(`   Password: ${password}`);
      }
    }

    console.log("\n🎉 Main admin ready!");
    console.log(`\nYou can now login at: http://localhost:3003/login`);
    console.log(`Email: ${email}`);
    console.log(`Password: ${password}`);
    console.log(`\n⚠️  IMPORTANT: Change the password after first login!`);
  } catch (error) {
    console.error("❌ Error creating main admin:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

createMainAdmin();

