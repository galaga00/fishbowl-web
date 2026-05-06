import Link from "next/link";
import { IgnoreAnalyticsControl } from "./ignore-control";
import { PurgeDataControl } from "./purge-control";
import { createServerSupabaseClient, hasServerSupabaseConfig } from "@/lib/supabase-server";
import type { Game, Player, Prompt, Team, Turn } from "@/lib/types";

export const dynamic = "force-dynamic";

type OwnerAnalyticsPageProps = {
  searchParams: Promise<{
    key?: string;
  }>;
};

type AnalyticsEventRow = {
  id: string;
  event_name: string;
  game_id: string | null;
  player_id: string | null;
  path: string | null;
  referrer: string | null;
  device_type: string | null;
  ip_hash: string | null;
  country: string | null;
  region: string | null;
  city: string | null;
  play_mode: string | null;
  prompt_mode: string | null;
  phase: string | null;
  player_count: number | null;
  team_count: number | null;
  prompt_count: number | null;
  metadata: Record<string, unknown>;
  created_at: string;
};

export default async function OwnerAnalyticsPage({ searchParams }: OwnerAnalyticsPageProps) {
  const { key } = await searchParams;
  const ownerKey = process.env.OWNER_ANALYTICS_KEY;

  if (!ownerKey) {
    return (
      <main className="shell">
        <section className="card stack">
          <h1>Owner Analytics</h1>
          <p className="notice">Set OWNER_ANALYTICS_KEY before using this private dashboard.</p>
        </section>
      </main>
    );
  }

  if (key !== ownerKey) {
    return (
      <main className="shell">
        <section className="card stack">
          <h1>Owner Analytics</h1>
          <p className="muted">This page is private. Add your owner key to the URL to view it.</p>
          <form className="owner-key-form" action="/owner/analytics">
            <label className="field" htmlFor="key">
              <span>Owner key</span>
              <input className="input" id="key" name="key" type="password" autoComplete="off" />
            </label>
            <button className="button accent">Open dashboard</button>
          </form>
          <Link className="button secondary" href="/">
            Back to game
          </Link>
        </section>
      </main>
    );
  }

  if (!hasServerSupabaseConfig) {
    return (
      <main className="shell">
        <section className="card stack">
          <h1>Owner Analytics</h1>
          <p className="notice">Supabase environment variables are missing.</p>
        </section>
      </main>
    );
  }

  const supabase = createServerSupabaseClient();
  const [eventsResult, gamesResult, playersResult, promptsResult, teamsResult, turnsResult] = await Promise.all([
    supabase.from("analytics_events").select("*").order("created_at", { ascending: false }).limit(1500),
    supabase.from("games").select("*").order("created_at", { ascending: false }).limit(200),
    supabase.from("players").select("*").order("created_at", { ascending: false }).limit(1000),
    supabase.from("prompts").select("id, game_id, status, created_at").order("created_at", { ascending: false }).limit(3000),
    supabase.from("teams").select("*").order("created_at", { ascending: false }).limit(1000),
    supabase.from("turns").select("*").order("started_at", { ascending: false }).limit(1000)
  ]);

  const events = ((eventsResult.data ?? []) as AnalyticsEventRow[]).filter(Boolean);
  const games = ((gamesResult.data ?? []) as Game[]).filter(Boolean);
  const players = ((playersResult.data ?? []) as Player[]).filter(Boolean);
  const prompts = ((promptsResult.data ?? []) as Pick<Prompt, "id" | "game_id" | "status" | "created_at">[]).filter(Boolean);
  const teams = ((teamsResult.data ?? []) as Team[]).filter(Boolean);
  const turns = ((turnsResult.data ?? []) as Turn[]).filter(Boolean);

  const gamesById = new Map(games.map((game) => [game.id, game]));
  const playersByGame = countBy(players, "game_id");
  const promptsByGame = countBy(prompts, "game_id");
  const turnsByGame = countBy(turns, "game_id");
  const teamsByGame = groupBy(teams, "game_id");
  const recentEvents = events.slice(0, 80);
  const recentGames = games.slice(0, 40);
  const knownGeoEvents = events.filter((event) => event.country || event.region || event.city);
  const startedGames = games.filter(isStartedGame);
  const playersInStartedGames = startedGames.reduce((total, game) => total + (playersByGame.get(game.id) ?? 0), 0);

  return (
    <main className="shell owner-shell">
      <header className="topbar">
        <div className="brand">
          <strong>Owner Analytics</strong>
          <span className="eyebrow">Fish Bowl private dashboard</span>
        </div>
        <Link className="button secondary" href="/">
          Home
        </Link>
      </header>

      {(eventsResult.error || gamesResult.error || playersResult.error || promptsResult.error || teamsResult.error || turnsResult.error) ? (
        <p className="notice">Some analytics data could not be loaded. Check Supabase logs if this persists.</p>
      ) : null}

      <IgnoreAnalyticsControl />
      <PurgeDataControl ownerKey={ownerKey} />

      <section className="analytics-grid">
        <MetricCard label="Games created" value={games.length} />
        <MetricCard label="Players" value={players.length} />
        <MetricCard label="Prompts/cards" value={prompts.length} />
        <MetricCard label="Turns played" value={turns.length} />
        <MetricCard label="Page views" value={countEvents(events, "page_view")} />
        <MetricCard label="Joins tracked" value={countEvents(events, "player_joined")} />
        <MetricCard label="Games started" value={startedGames.length} />
        <MetricCard label="Players in started games" value={playersInStartedGames} />
      </section>

      <section className="card stack">
        <h2>Started game settings</h2>
        <Breakdown title="Play modes" rows={toRows(countByValue(startedGames.map((game) => game.play_mode)))} />
        <Breakdown title="Prompt modes" rows={toRows(countByValue(startedGames.map((game) => game.prompt_mode)))} />
        <Breakdown title="Devices" rows={toRows(countByValue(events.map((event) => event.device_type ?? "unknown")))} />
        <Breakdown title="Categories used" rows={toRows(countByKnownValue(startedGames.flatMap((game) => game.prompt_categories ?? []))).slice(0, 16)} />
        <Breakdown title="Known countries" rows={toRows(countByKnownValue(knownGeoEvents.map((event) => event.country))).slice(0, 12)} />
        <Breakdown title="Known regions" rows={toRows(countByKnownValue(knownGeoEvents.map((event) => formatKnownLocationPart(event.region, event.country)))).slice(0, 12)} />
        <Breakdown title="Known cities" rows={toRows(countByKnownValue(knownGeoEvents.map((event) => formatKnownLocation(event)))).slice(0, 12)} />
      </section>

      <section className="card stack">
        <h2>Recent games</h2>
        <div className="analytics-table-wrap">
          <table className="analytics-table">
            <thead>
              <tr>
                <th>Game</th>
                <th>Created</th>
                <th>State</th>
                <th>Mode</th>
                <th>Players</th>
                <th>Prompts</th>
                <th>Categories</th>
                <th>Turns</th>
                <th>Scores</th>
              </tr>
            </thead>
            <tbody>
              {recentGames.map((game) => (
                <tr key={game.id}>
                  <td>
                    <strong>{game.code}</strong>
                    <span>{shortId(game.id)}</span>
                  </td>
                  <td>{formatDate(game.created_at)}</td>
                  <td>{game.phase}</td>
                  <td>
                    {formatMode(game.play_mode)}
                    <span>{formatMode(game.prompt_mode)}</span>
                  </td>
                  <td>{playersByGame.get(game.id) ?? 0}</td>
                  <td>{promptsByGame.get(game.id) ?? 0}</td>
                  <td>{formatCategories(game.prompt_categories)}</td>
                  <td>{turnsByGame.get(game.id) ?? 0}</td>
                  <td>{formatScores(teamsByGame.get(game.id) ?? [])}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card stack">
        <h2>Recent events</h2>
        <div className="analytics-table-wrap">
          <table className="analytics-table">
            <thead>
              <tr>
                <th>Time</th>
                <th>Event</th>
                <th>Game</th>
                <th>Path</th>
                <th>Device</th>
                <th>Location</th>
                <th>IP hash</th>
                <th>Referrer</th>
              </tr>
            </thead>
            <tbody>
              {recentEvents.map((event) => (
                <tr key={event.id}>
                  <td>{formatDate(event.created_at)}</td>
                  <td>{event.event_name}</td>
                  <td>{event.game_id ? (gamesById.get(event.game_id)?.code ?? shortId(event.game_id)) : "none"}</td>
                  <td>{event.path ?? "none"}</td>
                  <td>{event.device_type ?? "unknown"}</td>
                  <td>{formatLocation(event)}</td>
                  <td>{event.ip_hash ? shortId(event.ip_hash) : "none"}</td>
                  <td>{event.referrer ? truncate(event.referrer, 34) : "direct"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}

function MetricCard({ label, value }: { label: string; value: number }) {
  return (
    <section className="analytics-metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </section>
  );
}

function Breakdown({ title, rows }: { title: string; rows: Array<[string, number]> }) {
  return (
    <div className="analytics-breakdown">
      <h3>{title}</h3>
      {rows.length > 0 ? (
        rows.map(([label, count]) => (
          <div className="analytics-breakdown-row" key={label}>
            <span>{formatMode(label)}</span>
            <strong>{count}</strong>
          </div>
        ))
      ) : (
        <p className="muted">No data yet.</p>
      )}
    </div>
  );
}

function countEvents(events: AnalyticsEventRow[], eventName: string) {
  return events.filter((event) => event.event_name === eventName).length;
}

function countBy<T extends Record<string, unknown>>(rows: T[], key: keyof T) {
  const counts = new Map<string, number>();
  rows.forEach((row) => {
    const value = row[key];
    if (typeof value !== "string") return;
    counts.set(value, (counts.get(value) ?? 0) + 1);
  });
  return counts;
}

function groupBy<T extends Record<string, unknown>>(rows: T[], key: keyof T) {
  const groups = new Map<string, T[]>();
  rows.forEach((row) => {
    const value = row[key];
    if (typeof value !== "string") return;
    groups.set(value, [...(groups.get(value) ?? []), row]);
  });
  return groups;
}

function countByValue(values: Array<string | null | undefined>) {
  const counts = new Map<string, number>();
  values.forEach((value) => {
    const label = value || "unknown";
    counts.set(label, (counts.get(label) ?? 0) + 1);
  });
  return counts;
}

function countByKnownValue(values: Array<string | null | undefined>) {
  const counts = new Map<string, number>();
  values.forEach((value) => {
    if (!value) return;
    counts.set(value, (counts.get(value) ?? 0) + 1);
  });
  return counts;
}

function isStartedGame(game: Game) {
  return game.phase !== "setup" && game.phase !== "lobby";
}

function toRows(counts: Map<string, number>) {
  return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
}

function formatDate(value: string) {
  const formattedDate = new Intl.DateTimeFormat("en-US", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Los_Angeles"
  }).format(new Date(value));
  return `${formattedDate} PT`;
}

function formatMode(value: string) {
  return value.replaceAll("_", " ");
}

function formatCategories(categories: string[] | null) {
  if (!categories || categories.length === 0) return "none";
  return categories.map(formatMode).join(", ");
}

function formatLocation(event: Pick<AnalyticsEventRow, "city" | "country" | "region">) {
  return [event.city, event.region, event.country].filter(Boolean).join(", ") || "unknown";
}

function formatKnownLocation(event: Pick<AnalyticsEventRow, "city" | "country" | "region">) {
  return [event.city, event.region, event.country].filter(Boolean).join(", ") || null;
}

function formatKnownLocationPart(value: string | null, country: string | null) {
  return [value, country].filter(Boolean).join(", ") || null;
}

function formatScores(teams: Team[]) {
  if (teams.length === 0) return "none";
  return teams
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((team) => `${team.name}: ${team.score}`)
    .join(" / ");
}

function shortId(value: string) {
  return value.slice(0, 8);
}

function truncate(value: string, maxLength: number) {
  return value.length > maxLength ? `${value.slice(0, maxLength - 1)}...` : value;
}
