import { PrismaClient } from "@prisma/client";
import { config } from "dotenv";
import { existsSync } from "fs";
import { resolve } from "path";

// Load .gateway.env FIRST (with override) — this file holds the real Supabase
// credentials and is not touched by the sandbox's .env reset mechanism.
// Then load .env as a fallback. On Vercel neither file exists and the
// platform's env vars are used directly.
const gatewayPath = resolve(process.cwd(), ".gateway.env");
if (existsSync(gatewayPath)) {
  config({ path: gatewayPath, override: true });
}
config({ override: true });

// Enabled local database support (SQLite or PostgreSQL)

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "production" ? ["error"] : ["error", "warn"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
