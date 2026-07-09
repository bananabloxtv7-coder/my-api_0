import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { encrypt, preview } from "@/lib/crypto";
import { audit, getClientIp } from "@/lib/audit";
import { invalidateUserCache } from "@/lib/proxy/cache";

export const runtime = "nodejs";

/** GET /api/providers/[id]/keys — list keys (metadata only, no secrets) */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const provider = await db.provider.findFirst({
    where: { id, userId: user.id },
    select: { id: true },
  });
  if (!provider) return Response.json({ error: "Not found" }, { status: 404 });

  const keys = await db.providerApiKey.findMany({
    where: { providerId: id },
    orderBy: [{ isActive: "desc" }, { createdAt: "desc" }],
    select: {
      id: true,
      name: true,
      keyPreview: true,
      isActive: true,
      status: true,
      lastError: true,
      lastErrorAt: true,
      lastUsedAt: true,
      cooldownUntil: true,
      totalRequests: true,
      totalErrors: true,
      totalSuccess: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  // Auto-recover: if a key's cooldown has expired, mark it active in DB so the
  // dashboard shows the correct state. This runs in the background.
  const now = new Date();
  for (const k of keys) {
    if (
      k.isActive &&
      (k.status === "rate_limited" || k.status === "error") &&
      k.cooldownUntil &&
      k.cooldownUntil < now
    ) {
      // Update in DB (fire-and-forget) and in the response object
      void db.providerApiKey.update({
        where: { id: k.id },
        data: { status: "active", cooldownUntil: null },
      }).catch(() => {});
      k.status = "active";
      k.cooldownUntil = null;
    }
  }

  return Response.json({ keys });
}

/** POST /api/providers/[id]/keys — add a new (encrypted) API key */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const provider = await db.provider.findFirst({
    where: { id, userId: user.id },
    select: { id: true, name: true },
  });
  if (!provider) return Response.json({ error: "Not found" }, { status: 404 });

  let body: { key?: string; name?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const key = body.key?.trim();
  if (!key) return Response.json({ error: "key is required" }, { status: 400 });

  const encryptedKey = encrypt(key);
  const created = await db.providerApiKey.create({
    data: {
      providerId: id,
      name: body.name?.trim() || null,
      encryptedKey,
      keyPreview: preview(key),
      isActive: true,
      status: "active",
    },
    select: {
      id: true,
      name: true,
      keyPreview: true,
      isActive: true,
      status: true,
      createdAt: true,
    },
  });

  await audit({
    userId: user.id,
    action: "create_key",
    entity: "providerKey",
    entityId: created.id,
    details: { providerId: id, providerName: provider.name },
    ipAddress: getClientIp(req),
  });
  invalidateUserCache(user.id);

  return Response.json({ key: created }, { status: 201 });
}
