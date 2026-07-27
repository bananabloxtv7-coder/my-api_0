import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { audit, getClientIp } from "@/lib/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** PATCH /api/master-keys/[id] — toggle active / rename */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const owned = await db.masterApiKey.findFirst({
    where: { id, userId: user.id },
  });
  if (!owned) return Response.json({ error: "Not found" }, { status: 404 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const data: Record<string, unknown> = {};
  if (typeof body.isActive === "boolean") data.isActive = body.isActive;
  if (typeof body.name === "string") data.name = body.name.trim();

  const updated = await db.masterApiKey.update({ where: { id }, data });
  await audit({
    userId: user.id,
    action: "update_master_key",
    entity: "masterApiKey",
    entityId: id,
    details: data,
    ipAddress: getClientIp(req),
  });

  return Response.json({ key: updated });
}

/** DELETE /api/master-keys/[id] */
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const owned = await db.masterApiKey.findFirst({
    where: { id, userId: user.id },
  });
  if (!owned) return Response.json({ error: "Not found" }, { status: 404 });

  await db.masterApiKey.delete({ where: { id } });
  await audit({
    userId: user.id,
    action: "delete_master_key",
    entity: "masterApiKey",
    entityId: id,
    ipAddress: getClientIp(req),
  });

  return Response.json({ ok: true });
}
