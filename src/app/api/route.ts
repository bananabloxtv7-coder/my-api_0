import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api — health check */
export async function GET() {
  let dbOk = false;
  try {
    await db.$queryRaw`SELECT 1`;
    dbOk = true;
  } catch {
    dbOk = false;
  }
  return Response.json({
    ok: true,
    service: "smart-api-gateway",
    time: new Date().toISOString(),
    database: dbOk ? "connected" : "error",
  });
}
