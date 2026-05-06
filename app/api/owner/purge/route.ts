import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient, hasServerSupabaseConfig } from "@/lib/supabase-server";

const ZERO_UUID = "00000000-0000-0000-0000-000000000000";
const PURGE_TABLES = ["analytics_events", "game_events", "turns", "draft_cards", "prompts", "players", "teams", "games"] as const;

export async function POST(request: NextRequest) {
  if (!process.env.OWNER_ANALYTICS_KEY) {
    return NextResponse.json({ ok: false, error: "missing-owner-key" }, { status: 500 });
  }

  if (!hasServerSupabaseConfig) {
    return NextResponse.json({ ok: false, error: "missing-supabase-config" }, { status: 500 });
  }

  const body = (await request.json().catch(() => null)) as { key?: string } | null;
  if (body?.key !== process.env.OWNER_ANALYTICS_KEY) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const supabase = createServerSupabaseClient();
  for (const table of PURGE_TABLES) {
    const { error } = await supabase.from(table).delete().neq("id", ZERO_UUID);
    if (error) {
      return NextResponse.json({ ok: false, error: `failed-${table}` }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: true });
}
