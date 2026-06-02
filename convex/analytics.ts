import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

const nullableString = v.union(v.string(), v.null());
const nullableNumber = v.union(v.number(), v.null());

export const record = mutation({
  args: {
    event_name: v.string(),
    game_id: nullableString,
    player_id: nullableString,
    path: nullableString,
    referrer: nullableString,
    user_agent: nullableString,
    device_type: nullableString,
    ip_hash: nullableString,
    country: nullableString,
    region: nullableString,
    city: nullableString,
    play_mode: nullableString,
    prompt_mode: nullableString,
    phase: nullableString,
    player_count: nullableNumber,
    team_count: nullableNumber,
    prompt_count: nullableNumber,
    metadata: v.any()
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("analytics_events", {
      ...args,
      created_at: new Date().toISOString()
    });
  }
});

export const ownerSnapshot = query({
  args: {},
  handler: async (ctx) => {
    const [events, games, players, prompts, teams, turns] = await Promise.all([
      ctx.db.query("analytics_events").collect(),
      ctx.db.query("games").collect(),
      ctx.db.query("players").collect(),
      ctx.db.query("prompts").collect(),
      ctx.db.query("teams").collect(),
      ctx.db.query("turns").collect()
    ]);

    return {
      events: events.map((event) => ({ ...stripDoc(event), id: event._id })).sort(descCreated).slice(0, 1500),
      games: games.map((game) => ({ ...stripDoc(game), id: game._id })).sort(descCreated).slice(0, 200),
      players: players.map((player) => ({ ...stripDoc(player), id: player._id })).sort(descCreated).slice(0, 1000),
      prompts: prompts
        .map((prompt) => ({
          id: prompt._id,
          game_id: prompt.game_id,
          status: prompt.status,
          created_at: prompt.created_at
        }))
        .sort(descCreated)
        .slice(0, 3000),
      teams: teams.map((team) => ({ ...stripDoc(team), id: team._id })).sort(descCreated).slice(0, 1000),
      turns: turns.map((turn) => ({ ...stripDoc(turn), id: turn._id })).sort((a, b) => b.started_at.localeCompare(a.started_at)).slice(0, 1000)
    };
  }
});

export const purgeAll = mutation({
  args: {},
  handler: async (ctx) => {
    for (const table of ["analytics_events", "game_events", "turns", "draft_cards", "prompts", "players", "teams", "games"] as const) {
      const rows = await ctx.db.query(table).collect();
      for (const row of rows) {
        await ctx.db.delete(row._id);
      }
    }
  }
});

function descCreated(a: { created_at: string }, b: { created_at: string }) {
  return b.created_at.localeCompare(a.created_at);
}

function stripDoc<T extends { _id: string; _creationTime: number }>(doc: T) {
  const { _id, _creationTime, ...rest } = doc;
  void _id;
  void _creationTime;
  return rest;
}
