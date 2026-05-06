"use client";

type AnalyticsPayload = {
  eventName: string;
  gameId?: string | null;
  playerId?: string | null;
  playMode?: string | null;
  promptMode?: string | null;
  phase?: string | null;
  playerCount?: number | null;
  teamCount?: number | null;
  promptCount?: number | null;
  metadata?: Record<string, unknown>;
};

export function trackAnalyticsEvent(payload: AnalyticsPayload) {
  if (typeof window === "undefined") return;

  const body = JSON.stringify({
    ...payload,
    path: window.location.pathname,
    referrer: document.referrer || null
  });

  if (navigator.sendBeacon) {
    const blob = new Blob([body], { type: "application/json" });
    navigator.sendBeacon("/api/analytics", blob);
    return;
  }

  fetch("/api/analytics", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body,
    keepalive: true
  }).catch(() => {
    // Analytics should never interrupt a party game.
  });
}
