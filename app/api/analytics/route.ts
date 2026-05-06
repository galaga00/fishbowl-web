import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient, hasServerSupabaseConfig } from "@/lib/supabase-server";

const MAX_TEXT_LENGTH = 500;
const MAX_METADATA_KEYS = 32;

type AnalyticsRequestBody = {
  eventName?: unknown;
  gameId?: unknown;
  playerId?: unknown;
  path?: unknown;
  referrer?: unknown;
  playMode?: unknown;
  promptMode?: unknown;
  phase?: unknown;
  playerCount?: unknown;
  teamCount?: unknown;
  promptCount?: unknown;
  metadata?: unknown;
};

export async function POST(request: NextRequest) {
  if (!hasServerSupabaseConfig) {
    return NextResponse.json({ ok: true, skipped: "missing-config" });
  }

  let body: AnalyticsRequestBody;
  try {
    body = (await request.json()) as AnalyticsRequestBody;
  } catch {
    return NextResponse.json({ ok: true, skipped: "invalid-json" });
  }

  const eventName = cleanText(body.eventName, 80);
  if (!eventName) {
    return NextResponse.json({ ok: true, skipped: "missing-event" });
  }

  const userAgent = request.headers.get("user-agent") ?? "";
  const supabase = createServerSupabaseClient();
  const { error } = await supabase.from("analytics_events").insert({
    event_name: eventName,
    game_id: cleanUuid(body.gameId),
    player_id: cleanUuid(body.playerId),
    path: cleanText(body.path, MAX_TEXT_LENGTH),
    referrer: cleanText(body.referrer, MAX_TEXT_LENGTH),
    user_agent: cleanText(userAgent, 700),
    device_type: getDeviceType(userAgent),
    play_mode: cleanText(body.playMode, 80),
    prompt_mode: cleanText(body.promptMode, 80),
    phase: cleanText(body.phase, 80),
    player_count: cleanNumber(body.playerCount),
    team_count: cleanNumber(body.teamCount),
    prompt_count: cleanNumber(body.promptCount),
    metadata: cleanMetadata(body.metadata)
  });

  if (error) {
    console.error("Analytics insert failed", error.message);
  }

  return NextResponse.json({ ok: true });
}

function cleanText(value: unknown, maxLength: number) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, maxLength);
}

function cleanUuid(value: unknown) {
  const text = cleanText(value, 80);
  if (!text) return null;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(text) ? text : null;
}

function cleanNumber(value: unknown) {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return Math.max(0, Math.min(100000, Math.round(value)));
}

function cleanMetadata(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .slice(0, MAX_METADATA_KEYS)
      .map(([key, entry]) => [key.slice(0, 80), cleanMetadataValue(entry)])
  );
}

function cleanMetadataValue(value: unknown): string | number | boolean | null {
  if (typeof value === "string") return value.slice(0, MAX_TEXT_LENGTH);
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "boolean") return value;
  return null;
}

function getDeviceType(userAgent: string) {
  const lowerUserAgent = userAgent.toLowerCase();
  if (/ipad|tablet/.test(lowerUserAgent)) return "tablet";
  if (/mobi|iphone|android/.test(lowerUserAgent)) return "mobile";
  return "desktop";
}
