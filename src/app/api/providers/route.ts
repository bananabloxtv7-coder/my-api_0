import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { audit, getClientIp } from "@/lib/audit";
import { invalidateUserCache } from "@/lib/proxy/cache";

export const runtime = "nodejs";

/** GET /api/providers — list the current user's providers with counts */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const providers = await db.provider.findMany({
    where: { userId: user.id },
    include: {
      _count: {
        select: { apiKeys: true, endpoints: true, models: true },
      },
      endpoints: true,
    },
    orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
  });

  return Response.json({ providers });
}

interface CreateProviderBody {
  name: string;
  baseUrl: string;
  authHeader?: string;
  authScheme?: string;
  protocol?: string;
  priority?: number;
  timeoutMs?: number;
  isActive?: boolean;
  endpoints?: Array<{ type: string; path: string; method?: string }>;
  models?: string[];
}

/** POST /api/providers — create a provider with optional endpoints & models */
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  let body: CreateProviderBody;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.name?.trim() || !body.baseUrl?.trim()) {
    return Response.json({ error: "name and baseUrl are required" }, { status: 400 });
  }

  try {
    new URL(body.baseUrl.trim());
  } catch {
    return Response.json({ error: "baseUrl must be a valid URL" }, { status: 400 });
  }

  const provider = await db.provider.create({
    data: {
      userId: user.id,
      name: body.name.trim(),
      baseUrl: body.baseUrl.trim().replace(/\/+$/, ""),
      authHeader: body.authHeader?.trim() || "Authorization",
      authScheme: body.authScheme?.trim() || "bearer",
      protocol: body.protocol?.trim() || "transparent",
      priority: body.priority ?? 0,
      timeoutMs: body.timeoutMs ?? 120000,
      isActive: body.isActive ?? true,
      endpoints:
        body.endpoints && body.endpoints.length > 0
          ? {
              create: body.endpoints.map((e) => ({
                type: e.type,
                path: e.path,
                method: e.method || "POST",
              })),
            }
          : undefined,
      models:
        body.models && body.models.length > 0
          ? { create: body.models.map((m) => ({ name: m })) }
          : undefined,
    },
    include: { endpoints: true, _count: { select: { apiKeys: true, models: true } } },
  });

  await audit({
    userId: user.id,
    action: "create_provider",
    entity: "provider",
    entityId: provider.id,
    details: { name: provider.name, baseUrl: provider.baseUrl },
    ipAddress: getClientIp(req),
  });
  invalidateUserCache(user.id);

  return Response.json({ provider }, { status: 201 });
}
