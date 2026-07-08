import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

export const runtime = "nodejs";

/** GET /api/stats — dashboard overview statistics (sequential to respect pool) */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const since7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  // Run queries sequentially to avoid exhausting a small connection pool.
  const providersCount = await db.provider.count({ where: { userId: user.id } });
  const keysCount = await db.providerApiKey.count({
    where: { provider: { userId: user.id } },
  });
  const activeKeysCount = await db.providerApiKey.count({
    where: { provider: { userId: user.id }, isActive: true, status: "active" },
  });
  const modelsCount = await db.model.count({ where: { provider: { userId: user.id } } });
  const masterKeysCount = await db.masterApiKey.count({ where: { userId: user.id } });
  const requests24h = await db.requestLog.count({
    where: { userId: user.id, createdAt: { gte: since } },
  });
  const success24h = await db.requestLog.count({
    where: { userId: user.id, createdAt: { gte: since }, success: true },
  });
  const errors24h = await db.requestLog.count({
    where: { userId: user.id, createdAt: { gte: since }, success: false },
  });

  // 7-day aggregation
  const total7d = await db.requestLog.count({
    where: { userId: user.id, createdAt: { gte: since7d } },
  });
  const success7dCount = await db.requestLog.count({
    where: { userId: user.id, createdAt: { gte: since7d }, success: true },
  });

  const topProviders = await db.requestLog.groupBy({
    by: ["providerName"],
    where: { userId: user.id, createdAt: { gte: since7d } },
    _count: true,
    orderBy: { _count: { providerName: "desc" } },
    take: 6,
  });

  const topModels = await db.requestLog.groupBy({
    by: ["model"],
    where: { userId: user.id, createdAt: { gte: since7d }, model: { not: null } },
    _count: true,
    orderBy: { _count: { model: "desc" } },
    take: 8,
  });

  const byEndpoint = await db.requestLog.groupBy({
    by: ["endpointType"],
    where: { userId: user.id, createdAt: { gte: since7d } },
    _count: true,
    orderBy: { _count: { endpointType: "desc" } },
  });

  const hourly = await db.requestLog.groupBy({
    by: ["success"],
    where: { userId: user.id, createdAt: { gte: since } },
    _count: true,
  });

  return Response.json({
    summary: {
      providers: providersCount,
      keys: keysCount,
      activeKeys: activeKeysCount,
      models: modelsCount,
      masterKeys: masterKeysCount,
      requests24h,
      success24h,
      errors24h,
      successRate7d: total7d > 0 ? Math.round((success7dCount / total7d) * 100) : 0,
    },
    topProviders: topProviders
      .filter((p) => p.providerName)
      .map((p) => ({ name: p.providerName, count: p._count })),
    topModels: topModels
      .filter((m) => m.model)
      .map((m) => ({ name: m.model, count: m._count })),
    byEndpoint: byEndpoint.map((e) => ({
      type: e.endpointType || "unknown",
      count: e._count,
    })),
    hourly,
  });
}
