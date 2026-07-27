import { db } from "@/lib/db";
import { verifyPassword, signToken, setSessionCookie } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import { audit, getClientIp } from "@/lib/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const ip = getClientIp(req);
  const rl = rateLimit({ key: `login:${ip || "anon"}`, limit: 20 });
  if (!rl.ok) {
    return Response.json({ error: "Too many login attempts. Try again later." }, { status: 429 });
  }

  let body: { email?: string; password?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const email = body.email?.trim().toLowerCase();
  const password = body.password;
  if (!email || !password) {
    return Response.json({ error: "Email and password are required" }, { status: 400 });
  }

  const user = await db.user.findUnique({ where: { email } });
  if (!user) {
    return Response.json({ error: "Invalid email or password" }, { status: 401 });
  }

  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) {
    return Response.json({ error: "Invalid email or password" }, { status: 401 });
  }

  const token = signToken({ sub: user.id, email: user.email, role: user.role });
  await setSessionCookie(token);
  await audit({ userId: user.id, action: "login", ipAddress: ip });

  return Response.json({
    user: { id: user.id, email: user.email, name: user.name, role: user.role },
    token,
  });
}
