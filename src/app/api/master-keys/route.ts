import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { generateMasterKey, sha256 } from "@/lib/crypto";
import { audit, getClientIp } from "@/lib/audit";

export const runtime = "nodejs";

/** GET /api/master-keys */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const keys = await db.masterApiKey.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      keyPrefix: true,
      keyPreview: true,
      isActive: true,
      createdAt: true,
      lastUsedAt: true,
      _count: { select: { requestLogs: true } },
    },
  });

  return Response.json({ keys });
}

/** POST /api/master-keys — generate a new master key (returned ONCE) */
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  let body: { name?: string };
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const { key, keyPrefix } = generateMasterKey();
  const created = await db.masterApiKey.create({
    data: {
      userId: user.id,
      name: body.name?.trim() || "Default",
      keyHash: sha256(key),
      keyPrefix,
      keyPreview: key.slice(-4),
      isActive: true,
    },
    select: {
      id: true,
      name: true,
      keyPrefix: true,
      keyPreview: true,
      isActive: true,
      createdAt: true,
    },
  });

  await audit({
    userId: user.id,
    action: "create_master_key",
    entity: "masterApiKey",
    entityId: created.id,
    ipAddress: getClientIp(req),
  });

  // The full key is returned only here — store it client-side, it cannot be retrieved again.
  return Response.json({ key: created, plainKey: key }, { status: 201 });
}
