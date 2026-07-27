import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { invalidateUserCache } from "@/lib/proxy/cache";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/providers/[id]/models */
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

  const models = await db.model.findMany({
    where: { providerId: id },
    orderBy: { name: "asc" },
  });
  return Response.json({ models });
}

/** POST /api/providers/[id]/models — add a model (or batch) */
export async function POST(
  req: Request,
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

  let body: { name?: string; models?: string[] };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const names = body.models
    ? body.models.map((m) => m.trim()).filter(Boolean)
    : body.name
    ? [body.name.trim()]
    : [];
  if (names.length === 0) {
    return Response.json({ error: "name or models is required" }, { status: 400 });
  }

  // upsert to avoid unique constraint errors
  const created: Array<{ id: string; name: string }> = [];
  for (const name of names) {
    const m = await db.model.upsert({
      where: { providerId_name: { providerId: id, name } },
      update: { isActive: true },
      create: { providerId: id, name },
    });
    created.push({ id: m.id, name: m.name });
  }
  invalidateUserCache(user.id);

  return Response.json({ models: created }, { status: 201 });
}

/** DELETE /api/providers/[id]/models?modelId=xxx — delete a single model */
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const url = new URL(req.url);
  const modelId = url.searchParams.get("modelId");
  if (!modelId) {
    return Response.json({ error: "modelId query parameter is required" }, { status: 400 });
  }

  const model = await db.model.findFirst({
    where: { id: modelId, providerId: id, provider: { userId: user.id } },
  });
  if (!model) return Response.json({ error: "Not found" }, { status: 404 });

  await db.model.delete({ where: { id: modelId } });
  invalidateUserCache(user.id);
  return Response.json({ ok: true });
}
