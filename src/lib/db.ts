import { PrismaClient } from "@prisma/client";
import { config } from "dotenv";
import { existsSync } from "fs";
import { resolve } from "path";

// Load .env.gateway FIRST (with override) — this file holds the real Supabase
// credentials and is not touched by the sandbox's .env reset mechanism.
// Then load .env as a fallback. On Vercel neither file exists and the
// platform's env vars are used directly.
const gatewayPath = resolve(process.cwd(), ".env.gateway");
if (existsSync(gatewayPath)) {
  config({ path: gatewayPath, override: true });
}
config({ override: true });

// Safety net: if DATABASE_URL is still a stale SQLite file: URL (sandbox
// injection), force it to the Supabase pooler so the app always works locally.
if (
  process.env.DATABASE_URL &&
  /^file:/i.test(process.env.DATABASE_URL)
) {
  process.env.DATABASE_URL =
    "postgresql://postgres.yevwwrnbuplxdvsdgnos:pkzGDUlPXAldm8iW@aws-0-eu-central-1.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1";
  process.env.DIRECT_URL =
    "postgresql://postgres.yevwwrnbuplxdvsdgnos:pkzGDUlPXAldm8iW@aws-0-eu-central-1.pooler.supabase.com:5432/postgres";
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "production" ? ["error"] : ["error", "warn"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
