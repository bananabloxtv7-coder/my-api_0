import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { audit, getClientIp } from "@/lib/audit";

export const runtime = "nodejs";

/** GET /api/providers/[id]/endpoints */
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

  const endpoints = await db.providerEndpoint.findMany({
    where: { providerId: id },
    orderBy: { type: "asc" },
  });
  return Response.json({ endpoints });
}

/** POST /api/providers/[id]/endpoints */
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

  let body: { type?: string; path?: string; method?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.type?.trim() || !body.path?.trim()) {
    return Response.json({ error: "type and path are required" }, { status: 400 });
  }

  const endpoint = await db.providerEndpoint.create({
    data: {
      providerId: id,
      type: body.type.trim(),
      path: body.path.trim(),
      method: body.method?.trim() || "POST",
    },
  });

  await audit({
    userId: user.id,
    action: "create_endpoint",
    entity: "endpoint",
    entityId: endpoint.id,
    details: { providerId: id, type: endpoint.type, path: endpoint.path },
    ipAddress: getClientIp(req),
  });

  return Response.json({ endpoint }, { status: 201 });
}
