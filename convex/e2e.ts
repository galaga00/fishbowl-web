import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { createJoinCode, getNextTurnAssignment } from "../lib/game-utils";
import type { GameEvent, GameSnapshot, Team } from "../lib/types";

const gameId = v.id("games");

export const seedReadyPassAndPlayGame = mutation({
  args: {
    secret: v.string(),
    promptCount: v.number(),
    teamPlayers: v.array(v.array(v.string())),
    turnDurationSeconds: v.union(v.literal(30), v.literal(60))
  },
  handler: async (ctx, args) => {
    requireSecret(args.secret);
    return seedReady(ctx, args.promptCount, args.teamPlayers, args.turnDurationSeconds);
  }
});

export const seedPlayingPassAndPlayGame = mutation({
  args: {
    secret: v.string(),
    promptCount: v.number(),
    teamPlayers: v.array(v.array(v.string())),
    turnDurationSeconds: v.union(v.literal(30), v.literal(60))
  },
  handler: async (ctx, args) => {
    requireSecret(args.secret);
    const seeded = await seedReady(ctx, args.promptCount, args.teamPlayers, args.turnDurationSeconds);
    const snapshot = await loadSnapshot(ctx, seeded.gameId);
    if (!snapshot.game.current_team_id || !snapshot.game.active_player_id) {
      throw new Error("E2E seed did not create a playable turn assignment.");
    }
    await ctx.db.insert("turns", {
      game_id: seeded.gameId,
      team_id: snapshot.game.current_team_id as Id<"teams">,
      player_id: snapshot.game.active_player_id as Id<"players">,
      started_at: nowIso(),
      ended_at: null,
      correct_count: 0,
      skip_count: 0
    });
    await ctx.db.patch(seeded.gameId, { phase: "playing" });
    return seeded;
  }
});

export const deleteTestGames = mutation({
  args: { secret: v.string(), gameIds: v.array(gameId) },
  handler: async (ctx, args) => {
    requireSecret(args.secret);
    for (const id of Array.from(new Set(args.gameIds))) {
      await deleteRows(ctx, "analytics_events", id);
      await deleteRows(ctx, "game_events", id);
      await deleteRows(ctx, "turns", id);
      await deleteRows(ctx, "draft_cards", id);
      await deleteRows(ctx, "prompts", id);
      await deleteRows(ctx, "players", id);
      await deleteRows(ctx, "teams", id);
      const game = await ctx.db.get(id);
      if (game) await ctx.db.delete(id);
    }
  }
});

export const getActivePlayerName = query({
  args: { secret: v.string(), gameId },
  handler: async (ctx, args) => {
    requireSecret(args.secret);
    const game = await ctx.db.get(args.gameId);
    if (!game?.active_player_id) return null;
    const player = await ctx.db.get(game.active_player_id);
    return player?.name ?? null;
  }
});

export const loadSeededSnapshot = query({
  args: { secret: v.string(), gameId },
  handler: async (ctx, args) => {
    requireSecret(args.secret);
    return loadSnapshot(ctx, args.gameId);
  }
});

export const advanceTurnWithAssignmentHelper = mutation({
  args: { secret: v.string(), gameId },
  handler: async (ctx, args) => {
    requireSecret(args.secret);
    const snapshot = await loadSnapshot(ctx, args.gameId);
    const nextAssignment = getNextTurnAssignment(snapshot);
    if (!nextAssignment || !snapshot.game.current_prompt_id) {
      throw new Error("Seeded game was not ready to advance.");
    }
    await ctx.db.patch(args.gameId, {
      phase: "ready",
      active_player_id: nextAssignment.player.id as Id<"players">,
      current_team_id: nextAssignment.team.id as Id<"teams">,
      turn_number: snapshot.game.turn_number + 1
    });
  }
});

export const setActiveTurnStartedAt = mutation({
  args: { secret: v.string(), gameId, startedAt: v.string() },
  handler: async (ctx, args) => {
    requireSecret(args.secret);
    const activeTurns = (await ctx.db.query("turns").withIndex("by_game", (q) => q.eq("game_id", args.gameId)).collect()).filter(
      (turn) => turn.ended_at === null
    );
    if (activeTurns.length !== 1) throw new Error(`Expected one active turn, found ${activeTurns.length}.`);
    await ctx.db.patch(activeTurns[0]._id, { started_at: args.startedAt });
    return { updatedTurnId: activeTurns[0]._id };
  }
});

async function seedReady(ctx: MutationCtx, promptCount: number, teamPlayers: string[][], turnDurationSeconds: 30 | 60) {
  const flatPlayers = teamPlayers.flat();
  const hostName = flatPlayers[0] ?? "Austin";
  const id = await ctx.db.insert("games", {
    code: createJoinCode(),
    phase: "setup",
    host_player_id: null,
    current_team_id: null,
    active_player_id: null,
    current_prompt_id: null,
    turn_number: 0,
    round_number: 1,
    prompts_per_player: 1,
    turn_duration_seconds: turnDurationSeconds,
    cards_dealt_per_player: 1,
    cards_kept_per_player: 1,
    pass_play_card_count: Math.max(10, promptCount),
    expected_players: flatPlayers.length,
    team_assignment_mode: "auto",
    prompt_mode: "deck",
    prompt_categories: ["mixed"],
    play_mode: "pass_and_play",
    paused_at: null,
    created_at: nowIso()
  });

  const teams: Array<{ id: Id<"teams">; sort_order: number }> = [];
  for (const [sort_order] of teamPlayers.entries()) {
    teams.push({
      id: await ctx.db.insert("teams", {
        game_id: id,
        name: `Team ${sort_order + 1}`,
        score: 0,
        sort_order,
        created_at: nowIso()
      }),
      sort_order
    });
  }

  const baseCreatedAt = Date.now() - flatPlayers.length * 1_000;
  const playerIdsByName: Record<string, string> = {};
  let hostPlayerId: Id<"players"> | null = null;
  for (const [teamIndex, players] of teamPlayers.entries()) {
    for (const [playerIndex, name] of players.entries()) {
      const flatIndex = teamPlayers.slice(0, teamIndex).reduce((count, team) => count + team.length, 0) + playerIndex;
      const playerId = await ctx.db.insert("players", {
        game_id: id,
        name,
        is_host: name === hostName,
        team_id: teams[teamIndex]?.id ?? null,
        has_submitted: true,
        created_at: new Date(baseCreatedAt + flatIndex * 1_000).toISOString()
      });
      playerIdsByName[name] = playerId;
      if (name === hostName) hostPlayerId = playerId;
    }
  }

  if (!hostPlayerId) throw new Error("E2E seed did not create a host player.");
  const promptIds: Array<{ id: Id<"prompts">; deck_order: number }> = [];
  for (let index = 0; index < promptCount; index += 1) {
    promptIds.push({
      id: await ctx.db.insert("prompts", {
        game_id: id,
        player_id: hostPlayerId,
        text: `Prompt ${index + 1}`,
        category: "E2E",
        description: `Seeded Prompt ${index + 1}`,
        status: index === 0 ? "active" : "available",
        deck_order: index,
        created_at: nowIso()
      }),
      deck_order: index
    });
  }

  const firstPrompt = promptIds.find((prompt) => prompt.deck_order === 0);
  const firstTeam = teams[0];
  if (!firstPrompt || !firstTeam) throw new Error("E2E seed did not create first prompt/team.");

  await ctx.db.patch(id, {
    phase: "ready",
    host_player_id: hostPlayerId,
    active_player_id: hostPlayerId,
    current_team_id: firstTeam.id,
    current_prompt_id: firstPrompt.id,
    turn_number: 1,
    round_number: 1
  });

  return { gameId: id, hostPlayerId, playerIdsByName };
}

async function loadSnapshot(ctx: QueryCtx | MutationCtx, id: Id<"games">): Promise<GameSnapshot> {
  const game = await ctx.db.get(id);
  if (!game) throw new Error("E2E seed could not load game.");
  const [players, teams, prompts, draftCards, turns, events] = await Promise.all([
    ctx.db.query("players").withIndex("by_game", (q) => q.eq("game_id", id)).collect(),
    ctx.db.query("teams").withIndex("by_game", (q) => q.eq("game_id", id)).collect(),
    ctx.db.query("prompts").withIndex("by_game", (q) => q.eq("game_id", id)).collect(),
    ctx.db.query("draft_cards").withIndex("by_game", (q) => q.eq("game_id", id)).collect(),
    ctx.db.query("turns").withIndex("by_game", (q) => q.eq("game_id", id)).collect(),
    ctx.db.query("game_events").withIndex("by_game", (q) => q.eq("game_id", id)).collect()
  ]);
  const activeTurn = turns.filter((turn) => turn.ended_at === null).sort((a, b) => b.started_at.localeCompare(a.started_at))[0] ?? null;
  const latestUndoableEvent = events.filter((event) => event.undone_at === null).sort((a, b) => b.created_at.localeCompare(a.created_at))[0] ?? null;
  return {
    game: { ...stripDoc(game), id: game._id },
    players: players.map((player) => ({ ...stripDoc(player), id: player._id })).sort((a, b) => a.created_at.localeCompare(b.created_at)),
    teams: teams.map(toTeam).sort((a, b) => a.sort_order - b.sort_order),
    prompts: prompts.map((prompt) => ({ ...stripDoc(prompt), id: prompt._id })).sort((a, b) => (a.deck_order ?? 9999) - (b.deck_order ?? 9999)),
    draftCards: draftCards.map((card) => ({ ...stripDoc(card), id: card._id })).sort((a, b) => a.sort_order - b.sort_order),
    activeTurn: activeTurn ? { ...stripDoc(activeTurn), id: activeTurn._id } : null,
    latestUndoableEvent: latestUndoableEvent ? ({ ...stripDoc(latestUndoableEvent), id: latestUndoableEvent._id } as GameEvent) : null
  };
}

async function deleteRows(
  ctx: MutationCtx,
  table: "analytics_events" | "game_events" | "turns" | "draft_cards" | "prompts" | "players" | "teams",
  id: Id<"games">
) {
  const rows =
    table === "analytics_events"
      ? await ctx.db.query("analytics_events").withIndex("by_game", (q) => q.eq("game_id", id)).collect()
      : table === "game_events"
        ? await ctx.db.query("game_events").withIndex("by_game", (q) => q.eq("game_id", id)).collect()
        : table === "turns"
          ? await ctx.db.query("turns").withIndex("by_game", (q) => q.eq("game_id", id)).collect()
          : table === "draft_cards"
            ? await ctx.db.query("draft_cards").withIndex("by_game", (q) => q.eq("game_id", id)).collect()
            : table === "prompts"
              ? await ctx.db.query("prompts").withIndex("by_game", (q) => q.eq("game_id", id)).collect()
              : table === "players"
                ? await ctx.db.query("players").withIndex("by_game", (q) => q.eq("game_id", id)).collect()
                : await ctx.db.query("teams").withIndex("by_game", (q) => q.eq("game_id", id)).collect();
  for (const row of rows) {
    await ctx.db.delete(row._id);
  }
}

function requireSecret(secret: string) {
  const expected = process.env.E2E_TEST_SECRET;
  if (!expected || secret !== expected) throw new Error("Unauthorized E2E helper call.");
}

function nowIso() {
  return new Date().toISOString();
}

function toTeam(doc: Doc<"teams">): Team {
  return { id: doc._id, game_id: doc.game_id, name: doc.name, score: doc.score, sort_order: doc.sort_order };
}

function stripDoc<T extends { _id: string; _creationTime: number }>(doc: T) {
  const { _id, _creationTime, ...rest } = doc;
  void _id;
  void _creationTime;
  return rest;
}
