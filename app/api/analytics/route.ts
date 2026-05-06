import { NextRequest, NextResponse } from "next/server";
import { createHash } from "node:crypto";
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
  const ipAddress = getIpAddress(request);
  const country = cleanGeoHeader(request.headers.get("x-vercel-ip-country"), 2);
  const region = cleanGeoHeader(request.headers.get("x-vercel-ip-country-region"), 16);
  const city = cleanGeoHeader(request.headers.get("x-vercel-ip-city"), 120);
  const supabase = createServerSupabaseClient();
  const { error } = await supabase.from("analytics_events").insert({
    event_name: eventName,
    game_id: cleanUuid(body.gameId),
    player_id: cleanUuid(body.playerId),
    path: cleanText(body.path, MAX_TEXT_LENGTH),
    referrer: cleanText(body.referrer, MAX_TEXT_LENGTH),
    user_agent: cleanText(userAgent, 700),
    device_type: getDeviceType(userAgent),
    ip_hash: hashIpAddress(ipAddress),
    country,
    region,
    city,
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
  } else {
    await sendOwnerNotification({
      eventName,
      gameId: cleanUuid(body.gameId),
      path: cleanText(body.path, MAX_TEXT_LENGTH),
      playMode: cleanText(body.playMode, 80),
      promptMode: cleanText(body.promptMode, 80),
      playerCount: cleanNumber(body.playerCount),
      location: formatLocation({ country, region, city })
    });
  }

  return NextResponse.json({ ok: true });
}

function cleanGeoHeader(value: string | null, maxLength: number) {
  if (!value) return null;
  return decodeURIComponent(value).trim().slice(0, maxLength) || null;
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

function getIpAddress(request: NextRequest) {
  const forwardedFor = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwardedFor || request.headers.get("x-real-ip") || request.headers.get("x-vercel-forwarded-for") || null;
}

function hashIpAddress(ipAddress: string | null) {
  if (!ipAddress) return null;
  const salt = process.env.ANALYTICS_IP_SALT ?? process.env.OWNER_ANALYTICS_KEY ?? "fish-bowl";
  return createHash("sha256").update(`${salt}:${ipAddress}`).digest("hex");
}

function formatLocation({ city, country, region }: { city: string | null; country: string | null; region: string | null }) {
  return [city, region, country].filter(Boolean).join(", ") || "unknown";
}

async function sendOwnerNotification({
  eventName,
  gameId,
  location,
  path,
  playerCount,
  playMode,
  promptMode
}: {
  eventName: string;
  gameId: string | null;
  location: string;
  path: string | null;
  playerCount: number | null;
  playMode: string | null;
  promptMode: string | null;
}) {
  const apiKey = process.env.RESEND_API_KEY;
  const to = process.env.OWNER_NOTIFY_EMAIL;
  if (!apiKey || !to) return;

  const notifyEvents = (process.env.ANALYTICS_NOTIFY_EVENTS ?? "game_started")
    .split(",")
    .map((event) => event.trim())
    .filter(Boolean);
  if (!notifyEvents.includes(eventName)) return;

  const from = process.env.OWNER_NOTIFY_FROM ?? "Fish Bowl <onboarding@resend.dev>";
  const subject = eventName === "game_started" ? "Fish Bowl game started" : `Fish Bowl: ${eventName}`;
  const dashboardUrl = process.env.OWNER_ANALYTICS_KEY
    ? `https://fish-bowl-game.vercel.app/owner/analytics?key=${process.env.OWNER_ANALYTICS_KEY}`
    : "https://fish-bowl-game.vercel.app/owner/analytics";

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        authorization: `Bearer ${apiKey}`,
        "content-type": "application/json"
      },
      body: JSON.stringify({
        from,
        to,
        subject,
        text: [
          `Event: ${eventName}`,
          `Game: ${gameId ?? "unknown"}`,
          `Location: ${location}`,
          `Players: ${playerCount ?? "unknown"}`,
          `Mode: ${playMode ?? "unknown"} / ${promptMode ?? "unknown"}`,
          `Path: ${path ?? "unknown"}`,
          "",
          `Dashboard: ${dashboardUrl}`
        ].join("\n")
      })
    });

    if (!response.ok) {
      console.error("Owner notification failed", await response.text());
    }
  } catch (error) {
    console.error("Owner notification failed", error);
  }
}
