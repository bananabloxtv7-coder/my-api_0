import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const updated = await db.providerApiKey.updateMany({
      data: {
        status: "active",
        isActive: true,
        cooldownUntil: null,
        lastError: null,
      },
    });

    return NextResponse.json({
      success: true,
      message: `Reactivated ${updated.count} API keys in the database!`,
    });
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}

export async function POST() {
  return GET();
}
