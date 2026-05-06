"use client";

const ANALYTICS_IGNORE_KEY = "fish-bowl-ignore-analytics";
const ANALYTICS_IGNORE_QUERY_KEY = "ignoreAnalytics";

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

export function isAnalyticsIgnored() {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(ANALYTICS_IGNORE_KEY) === "true";
}

export function applyAnalyticsIgnoreFromUrl() {
  if (typeof window === "undefined") return false;
  const params = new URLSearchParams(window.location.search);
  const ignoreValue = params.get(ANALYTICS_IGNORE_QUERY_KEY);
  if (ignoreValue !== "1" && ignoreValue !== "true") return false;

  setAnalyticsIgnored(true);
  return true;
}

export function setAnalyticsIgnored(ignored: boolean) {
  if (typeof window === "undefined") return;
  if (ignored) {
    localStorage.setItem(ANALYTICS_IGNORE_KEY, "true");
  } else {
    localStorage.removeItem(ANALYTICS_IGNORE_KEY);
  }
  window.dispatchEvent(new Event("fish-bowl-analytics-ignore-change"));
}

export function trackAnalyticsEvent(payload: AnalyticsPayload) {
  if (typeof window === "undefined") return;
  applyAnalyticsIgnoreFromUrl();
  if (isAnalyticsIgnored()) return;

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
