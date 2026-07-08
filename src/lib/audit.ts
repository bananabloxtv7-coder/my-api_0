import { db } from "@/lib/db";

/**
 * Append an audit log entry. Best-effort: never throws.
 */
export async function audit(opts: {
  userId: string;
  action: string;
  entity?: string;
  entityId?: string;
  details?: unknown;
  ipAddress?: string | null;
}): Promise<void> {
  try {
    await db.auditLog.create({
      data: {
        userId: opts.userId,
        action: opts.action,
        entity: opts.entity,
        entityId: opts.entityId,
        details: opts.details ? JSON.stringify(opts.details) : null,
        ipAddress: opts.ipAddress ?? null,
      },
    });
  } catch {
    // audit must never break the main flow
  }
}

/** Helper to read the client IP from request headers. */
export function getClientIp(req: Request): string | null {
  const headers = req.headers;
  return (
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    headers.get("x-real-ip") ||
    null
  );
}
