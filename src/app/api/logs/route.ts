import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

export const runtime = "nodejs";

/** GET /api/logs — paginated request logs for the current user */
export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const limit = Math.min(parseInt(url.searchParams.get("limit") || "50"), 200);
  const offset = Math.max(parseInt(url.searchParams.get("offset") || "0"), 0);
  const providerId = url.searchParams.get("providerId");
  const success = url.searchParams.get("success");
  const model = url.searchParams.get("model");

  const where: Record<string, unknown> = { userId: user.id };
  if (providerId) where.providerId = providerId;
  if (model) where.model = model;
  if (success === "true") where.success = true;
  if (success === "false") where.success = false;

  const [logs, total] = await Promise.all([
    db.requestLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
      select: {
        id: true,
        method: true,
        path: true,
        model: true,
        endpointType: true,
        providerName: true,
        statusCode: true,
        durationMs: true,
        success: true,
        error: true,
        retried: true,
        createdAt: true,
      },
    }),
    db.requestLog.count({ where }),
  ]);

  return Response.json({ logs, total, limit, offset });
}
