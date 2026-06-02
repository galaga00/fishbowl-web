import { NextRequest, NextResponse } from "next/server";
import { api } from "@/convex/_generated/api";
import { createServerConvexClient, hasServerConvexConfig } from "@/lib/convex-server";

export async function POST(request: NextRequest) {
  if (!process.env.OWNER_ANALYTICS_KEY) {
    return NextResponse.json({ ok: false, error: "missing-owner-key" }, { status: 500 });
  }

  if (!hasServerConvexConfig) {
    return NextResponse.json({ ok: false, error: "missing-convex-config" }, { status: 500 });
  }

  const body = (await request.json().catch(() => null)) as { key?: string } | null;
  if (body?.key !== process.env.OWNER_ANALYTICS_KEY) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  try {
    await createServerConvexClient().mutation(api.analytics.purgeAll, {});
  } catch (error) {
    console.error("Owner purge failed", error);
    return NextResponse.json({ ok: false, error: "purge-failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
