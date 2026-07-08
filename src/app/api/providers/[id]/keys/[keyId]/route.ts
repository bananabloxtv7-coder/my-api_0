import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { audit, getClientIp } from "@/lib/audit";
import { invalidateUserCache } from "@/lib/proxy/cache";

export const runtime = "nodejs";

/** PATCH /api/providers/[id]/keys/[keyId] — toggle active, reset status, etc. */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string; keyId: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const { id, keyId } = await params;

  const key = await db.providerApiKey.findFirst({
    where: { id: keyId, providerId: id, provider: { userId: user.id } },
  });
  if (!key) return Response.json({ error: "Not found" }, { status: 404 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const data: Record<string, unknown> = {};
  if (typeof body.isActive === "boolean") data.isActive = body.isActive;
  if (typeof body.name === "string") data.name = body.name.trim() || null;

  // reset: re-enable a key that was disabled/cooldown
  if (body.reset === true) {
    data.status = "active";
    data.cooldownUntil = null;
    data.lastError = null;
    data.isActive = true;
  }

  const updated = await db.providerApiKey.update({
    where: { id: keyId },
    data,
    select: {
      id: true,
      name: true,
      keyPreview: true,
      isActive: true,
      status: true,
      lastError: true,
      cooldownUntil: true,
    },
  });

  await audit({
    userId: user.id,
    action: "update_key",
    entity: "providerKey",
    entityId: keyId,
    details: data,
    ipAddress: getClientIp(req),
  });
  invalidateUserCache(user.id);

  return Response.json({ key: updated });
}

/** DELETE /api/providers/[id]/keys/[keyId] */
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string; keyId: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const { id, keyId } = await params;

  const key = await db.providerApiKey.findFirst({
    where: { id: keyId, providerId: id, provider: { userId: user.id } },
  });
  if (!key) return Response.json({ error: "Not found" }, { status: 404 });

  await db.providerApiKey.delete({ where: { id: keyId } });

  await audit({
    userId: user.id,
    action: "delete_key",
    entity: "providerKey",
    entityId: keyId,
    ipAddress: getClientIp(req),
  });
  invalidateUserCache(user.id);

  return Response.json({ ok: true });
}
