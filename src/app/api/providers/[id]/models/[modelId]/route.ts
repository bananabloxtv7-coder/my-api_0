import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** DELETE /api/providers/[id]/models/[modelId] */
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string; modelId: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const { id, modelId } = await params;

  const model = await db.model.findFirst({
    where: { id: modelId, providerId: id, provider: { userId: user.id } },
  });
  if (!model) return Response.json({ error: "Not found" }, { status: 404 });

  await db.model.delete({ where: { id: modelId } });
  return Response.json({ ok: true });
}
