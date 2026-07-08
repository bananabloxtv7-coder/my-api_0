import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

export const runtime = "nodejs";

/** PATCH /api/providers/[id]/endpoints/[endpointId] */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string; endpointId: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const { id, endpointId } = await params;

  const endpoint = await db.providerEndpoint.findFirst({
    where: { id: endpointId, providerId: id, provider: { userId: user.id } },
  });
  if (!endpoint) return Response.json({ error: "Not found" }, { status: 404 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const data: Record<string, unknown> = {};
  if (typeof body.path === "string") data.path = body.path.trim();
  if (typeof body.method === "string") data.method = body.method.trim();
  if (typeof body.type === "string") data.type = body.type.trim();

  const updated = await db.providerEndpoint.update({
    where: { id: endpointId },
    data,
  });
  return Response.json({ endpoint: updated });
}

/** DELETE /api/providers/[id]/endpoints/[endpointId] */
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string; endpointId: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const { id, endpointId } = await params;

  const endpoint = await db.providerEndpoint.findFirst({
    where: { id: endpointId, providerId: id, provider: { userId: user.id } },
  });
  if (!endpoint) return Response.json({ error: "Not found" }, { status: 404 });

  await db.providerEndpoint.delete({ where: { id: endpointId } });
  return Response.json({ ok: true });
}
