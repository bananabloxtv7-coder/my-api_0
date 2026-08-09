import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { invalidateUserCache } from "@/lib/proxy/cache";
import { decrypt } from "@/lib/crypto";

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

/** POST /api/providers/[id]/models — add a model (or batch, or auto-discover) */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const provider = await db.provider.findFirst({
    where: { id, userId: user.id },
    include: { apiKeys: { where: { isActive: true, status: "active" } } },
  });
  if (!provider) return Response.json({ error: "Not found" }, { status: 404 });

  let body: { action?: string; name?: string; models?: string[] };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  // ── Auto-discovery Mode ──
  if (body.action === "discover") {
    const keyItem = provider.apiKeys[0];
    if (!keyItem) {
      return Response.json(
        { error: "لا يوجد مفتاح API نشط لهذا المزود. يرجى إضافة مفتاح أولاً." },
        { status: 400 }
      );
    }

    const base = provider.baseUrl.replace(/\/+$/, "");
    let url = `${base}/models`;
    const fwdHeaders = new Headers();

    try {
      const decryptedKey = decrypt(keyItem.encryptedKey);

      if (provider.authScheme === "bearer" || provider.authScheme === "raw") {
        if (provider.authHeader.toLowerCase() === "authorization") {
          fwdHeaders.set(
            "Authorization",
            provider.authScheme === "bearer" ? `Bearer ${decryptedKey}` : decryptedKey
          );
        } else {
          fwdHeaders.set(provider.authHeader, decryptedKey);
        }
      } else if (provider.authScheme === "x-api-key") {
        fwdHeaders.set("x-api-key", decryptedKey);
      } else if (provider.authScheme === "query") {
        url += `?${provider.authHeader || "key"}=${decryptedKey}`;
      } else {
        fwdHeaders.set(provider.authHeader, decryptedKey);
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);
      const res = await fetch(url, { headers: fwdHeaders, signal: controller.signal });
      clearTimeout(timeoutId);

      if (!res.ok) {
        return Response.json(
          { error: `فشل الاتصال بالمزود (${res.status} ${res.statusText})` },
          { status: 400 }
        );
      }

      const json = await res.json();
      const discoveredNames: string[] = [];

      if (json && Array.isArray(json.data)) {
        json.data.forEach((m: any) => {
          if (m && typeof m.id === "string") {
            discoveredNames.push(m.id.trim());
          }
        });
      }

      if (discoveredNames.length === 0) {
        return Response.json(
          { error: "لم يتم العثور على نماذج في استجابة المزود" },
          { status: 400 }
        );
      }

      const created: Array<{ id: string; name: string }> = [];
      for (const name of discoveredNames) {
        const m = await db.model.upsert({
          where: { providerId_name: { providerId: id, name } },
          update: { isActive: true },
          create: { providerId: id, name },
        });
        created.push({ id: m.id, name: m.name });
      }

      invalidateUserCache(user.id);
      return Response.json({ models: created, count: created.length }, { status: 200 });
    } catch (err: any) {
      return Response.json(
        { error: `فشل استكشاف النماذج: ${err.message || err}` },
        { status: 500 }
      );
    }
  }

  // ── Manual Addition Mode ──
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
