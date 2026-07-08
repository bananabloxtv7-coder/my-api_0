import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { audit, getClientIp } from "@/lib/audit";

export const runtime = "nodejs";

async function getOwnedProvider(userId: string, id: string) {
  return db.provider.findFirst({ where: { id, userId } });
}

/** GET /api/providers/[id] — full provider detail with keys, endpoints, models */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const provider = await db.provider.findFirst({
    where: { id, userId: user.id },
    include: {
      endpoints: { orderBy: { type: "asc" } },
      models: { orderBy: { name: "asc" } },
      apiKeys: { orderBy: { createdAt: "desc" } },
    },
  });
  if (!provider) return Response.json({ error: "Not found" }, { status: 404 });

  // Don't return encrypted keys, only metadata
  const safeKeys = provider.apiKeys.map((k) => ({
    id: k.id,
    name: k.name,
    keyPreview: k.keyPreview,
    isActive: k.isActive,
    status: k.status,
    lastError: k.lastError,
    lastErrorAt: k.lastErrorAt,
    lastUsedAt: k.lastUsedAt,
    cooldownUntil: k.cooldownUntil,
    totalRequests: k.totalRequests,
    totalErrors: k.totalErrors,
    totalSuccess: k.totalSuccess,
    createdAt: k.createdAt,
  }));

  return Response.json({
    provider: {
      ...provider,
      apiKeys: undefined,
      keys: safeKeys,
    },
  });
}

/** PATCH /api/providers/[id] — update provider fields */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const owned = await getOwnedProvider(user.id, id);
  if (!owned) return Response.json({ error: "Not found" }, { status: 404 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const allowed: Record<string, unknown> = {};
  for (const key of [
    "name",
    "baseUrl",
    "authHeader",
    "authScheme",
    "priority",
    "timeoutMs",
    "isActive",
  ]) {
    if (key in body) allowed[key] = body[key];
  }
  if (typeof allowed.baseUrl === "string") {
    try {
      new URL(allowed.baseUrl as string);
    } catch {
      return Response.json({ error: "baseUrl must be a valid URL" }, { status: 400 });
    }
    allowed.baseUrl = (allowed.baseUrl as string).replace(/\/+$/, "");
  }

  const provider = await db.provider.update({
    where: { id },
    data: allowed,
  });

  await audit({
    userId: user.id,
    action: "update_provider",
    entity: "provider",
    entityId: id,
    details: allowed,
    ipAddress: getClientIp(req),
  });

  return Response.json({ provider });
}

/** DELETE /api/providers/[id] */
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const owned = await getOwnedProvider(user.id, id);
  if (!owned) return Response.json({ error: "Not found" }, { status: 404 });

  await db.provider.delete({ where: { id } });

  await audit({
    userId: user.id,
    action: "delete_provider",
    entity: "provider",
    entityId: id,
    details: { name: owned.name },
    ipAddress: getClientIp(req),
  });

  return Response.json({ ok: true });
}
