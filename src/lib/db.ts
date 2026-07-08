import { PrismaClient } from "@prisma/client";
import { config } from "dotenv";

// Force-load .env and OVERRIDE any system-level env vars (e.g. a stale
// DATABASE_URL injected by the host). On platforms like Vercel the .env file
// is absent, so this is a no-op and the platform's env is used as-is.
config({ override: true });

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "production" ? ["error"] : ["error", "warn"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
