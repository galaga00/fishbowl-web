import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { buildPassPlayDeck, filterStarterDeckByCategories, getDefaultPassPlayCardCount, MIXED_PASS_PLAY_CATEGORY } from "../lib/pass-play-deck";
import { isStarterDeckCardAllowed } from "../lib/starter-deck";
import {
  createJoinCode,
  DEFAULT_CARDS_DEALT_PER_PLAYER,
  DEFAULT_CARDS_KEPT_PER_PLAYER,
  DEFAULT_PLAY_MODE,
  DEFAULT_PROMPTS_PER_PLAYER,
  DEFAULT_TEAM_ASSIGNMENT_MODE,
  TURN_DURATION_OPTIONS,
  TURN_DURATION_SECONDS,
  getFirstTurnAssignment,
  getNextTurnAssignment,
  hasPlayerDrafted,
  hasPlayerSubmitted,
  isFinalRound,
  shuffle
} from "../lib/game-utils";
import type { GameSnapshot, PlayMode, PromptMode, Team } from "../lib/types";

const gameId = v.id("games");
const playerId = v.id("players");
const teamId = v.id("teams");
const promptId = v.id("prompts");
const draftCardId = v.id("draft_cards");
const nowIso = () => new Date().toISOString();

const passAndPlayPlayer = v.object({
  name: v.string(),
  teamIndex: v.number()
});

const promptInput = v.union(
  v.string(),
  v.object({
    text: v.string(),
    category: v.optional(v.string())
  })
);

const actionStateArgs = {
  expectedPromptId: v.union(promptId, v.null()),
  expectedTeamId: v.union(teamId, v.null()),
  expectedActivePlayerId: v.union(playerId, v.null()),
  expectedTurnNumber: v.number()
};

export const createGame = mutation({
  args: { hostName: v.string() },
  handler: async (ctx, args) => {
    let id: Id<"games"> | null = null;
    let code = "";

    for (let attempt = 0; attempt < 5 && !id; attempt += 1) {
      code = createJoinCode();
      const existing = await ctx.db
        .query("games")
        .withIndex("by_code", (q) => q.eq("code", code))
        .unique();
      if (existing) continue;

      id = await ctx.db.insert("games", {
        code,
        host_player_id: null,
        phase: "setup",
        current_team_id: null,
        active_player_id: null,
        current_prompt_id: null,
        turn_number: 0,
        round_number: 1,
        turn_duration_seconds: TURN_DURATION_SECONDS,
        prompts_per_player: DEFAULT_PROMPTS_PER_PLAYER,
        cards_dealt_per_player: DEFAULT_CARDS_DEALT_PER_PLAYER,
        cards_kept_per_player: DEFAULT_CARDS_KEPT_PER_PLAYER,
        pass_play_card_count: getDefaultPassPlayCardCount(4),
        expected_players: null,
        team_assignment_mode: DEFAULT_TEAM_ASSIGNMENT_MODE,
        prompt_mode: "free",
        prompt_categories: [MIXED_PASS_PLAY_CATEGORY],
        play_mode: DEFAULT_PLAY_MODE,
        paused_at: null,
        created_at: nowIso()
      });
    }

    if (!id) throw new Error("Could not create game.");

    const host = await ctx.db.insert("players", {
      game_id: id,
      name: args.hostName.trim() || "Host",
      is_host: true,
      team_id: null,
      has_submitted: false,
      created_at: nowIso()
    });
    await ctx.db.patch(id, { host_player_id: host });

    const game = await ctx.db.get(id);
    const player = await ctx.db.get(host);
    if (!game || !player) throw new Error("Could not create game.");
    return { game: toGame(game), player: toPlayer(player) };
  }
});

export const saveGameSetup = mutation({
  args: {
    gameId,
    promptsPerPlayer: v.number(),
    teamNames: v.array(v.string()),
    teamAssignmentMode: v.union(v.literal("auto"), v.literal("choose")),
    promptMode: v.union(v.literal("free"), v.literal("category"), v.literal("deck")),
    expectedPlayers: v.union(v.number(), v.null()),
    cardsDealtPerPlayer: v.number(),
    cardsKeptPerPlayer: v.number(),
    turnDurationSeconds: v.number(),
    playMode: v.union(v.literal("multi_device"), v.literal("pass_and_play")),
    passAndPlayPlayers: v.array(passAndPlayPlayer),
    passPlayCardCount: v.number(),
    passPlayCategories: v.array(v.string()),
    promptCategories: v.array(v.string())
  },
  handler: async (ctx, args) => {
    const game = await requireGame(ctx, args.gameId);
    const cleanPromptsPerPlayer = clampRound(args.promptsPerPlayer, 1, 20);
    const cleanCardsDealtPerPlayer = clampRound(args.cardsDealtPerPlayer, 1, 20);
    const cleanCardsKeptPerPlayer = Math.min(cleanCardsDealtPerPlayer, clampRound(args.cardsKeptPerPlayer, 1, 20));
    const cleanTeamNames = args.teamNames.map((name, index) => name.trim() || `Team ${index + 1}`).slice(0, 12);
    const cleanPlayMode: PlayMode = args.playMode === "pass_and_play" ? "pass_and_play" : DEFAULT_PLAY_MODE;
    const cleanPromptMode: PromptMode = args.promptMode;
    const cleanPassAndPlayPlayers = args.passAndPlayPlayers
      .map((player, index) => ({
        name: player.name.trim() || `Player ${index + 1}`,
        teamIndex: Math.max(0, Math.round(player.teamIndex || 0))
      }))
      .slice(0, 40);
    const cleanPassPlayCardCount = clampRound(args.passPlayCardCount, 10, 80);
    const cleanPromptCategories = args.promptCategories.length > 0 ? args.promptCategories : [MIXED_PASS_PLAY_CATEGORY];
    const cleanExpectedPlayers = args.expectedPlayers ? clampRound(args.expectedPlayers, 1, 200) : null;
    const cleanTurnDurationSeconds = TURN_DURATION_OPTIONS.includes(args.turnDurationSeconds as (typeof TURN_DURATION_OPTIONS)[number])
      ? args.turnDurationSeconds
      : TURN_DURATION_SECONDS;

    if (cleanTeamNames.length < 1) throw new Error("Add at least one team.");

    await deleteByGame(ctx, "prompts", game._id);
    await deleteByGame(ctx, "draft_cards", game._id);
    await deleteByGame(ctx, "teams", game._id);

    const teams: Doc<"teams">[] = [];
    for (const [sort_order, name] of cleanTeamNames.entries()) {
      const id = await ctx.db.insert("teams", {
        game_id: game._id,
        name,
        score: 0,
        sort_order,
        created_at: nowIso()
      });
      const team = await ctx.db.get(id);
      if (team) teams.push(team);
    }
    const firstTeam = teams[0];
    if (!firstTeam) throw new Error("Add at least one team.");

    await ctx.db.patch(game._id, {
      prompts_per_player: cleanPromptsPerPlayer,
      turn_duration_seconds: cleanTurnDurationSeconds,
      cards_dealt_per_player: cleanCardsDealtPerPlayer,
      cards_kept_per_player: cleanCardsKeptPerPlayer,
      pass_play_card_count: cleanPassPlayCardCount,
      expected_players: cleanPlayMode === "pass_and_play" ? Math.max(cleanPassAndPlayPlayers.length, 1) : cleanExpectedPlayers,
      team_assignment_mode: cleanPlayMode === "pass_and_play" ? "auto" : args.teamAssignmentMode,
      prompt_mode: cleanPromptMode,
      prompt_categories: cleanPlayMode === "pass_and_play" ? args.passPlayCategories : cleanPromptCategories,
      play_mode: cleanPlayMode,
      phase: "lobby"
    });

    if (cleanPlayMode === "pass_and_play") {
      const host = await getHostPlayer(ctx, game._id);
      if (!host) throw new Error("Host player not found.");
      const players = cleanPassAndPlayPlayers.length > 0 ? cleanPassAndPlayPlayers : [{ name: host.name || "Player 1", teamIndex: 0 }];
      const hostPlayer = players[0] ?? { name: host.name, teamIndex: 0 };
      await ctx.db.patch(host._id, {
        name: hostPlayer.name,
        team_id: teams[hostPlayer.teamIndex % Math.max(teams.length, 1)]?._id ?? firstTeam._id,
        has_submitted: cleanPromptMode === "deck"
      });

      const existingPlayers = await playersByGame(ctx, game._id);
      for (const player of existingPlayers.filter((candidate) => !candidate.is_host)) {
        await ctx.db.delete(player._id);
      }

      for (const player of players.slice(1)) {
        await ctx.db.insert("players", {
          game_id: game._id,
          name: player.name,
          is_host: false,
          team_id: teams[player.teamIndex % Math.max(teams.length, 1)]?._id ?? firstTeam._id,
          has_submitted: cleanPromptMode === "deck",
          created_at: nowIso()
        });
      }

      if (cleanPromptMode === "deck") {
        const promptDeck = buildPassPlayDeck(cleanPassPlayCardCount, args.passPlayCategories);
        for (const card of promptDeck) {
          await ctx.db.insert("prompts", {
            game_id: game._id,
            player_id: host._id,
            text: card.title,
            description: card.description,
            category: card.category,
            status: "available",
            deck_order: null,
            created_at: nowIso()
          });
        }
      }
    } else {
      const host = await getHostPlayer(ctx, game._id);
      if (host) await ctx.db.patch(host._id, { team_id: firstTeam._id });
      if (cleanPromptMode === "deck") {
        const players = await playersByGame(ctx, game._id);
        for (const player of players) {
          await ensureDraftHand(ctx, game._id, player._id, cleanCardsDealtPerPlayer, cleanPromptCategories);
        }
      }
    }
  }
});

export const joinGame = mutation({
  args: { code: v.string(), playerName: v.string() },
  handler: async (ctx, args) => {
    const game = await ctx.db
      .query("games")
      .withIndex("by_code", (q) => q.eq("code", args.code.trim().toUpperCase()))
      .unique();

    if (!game) throw new Error("No game found for that code.");
    if (game.phase === "setup") throw new Error("The host is still setting up this game.");
    if (game.play_mode === "pass_and_play") throw new Error("This game is in Pass & Play mode. Use the host phone.");

    const teams = await teamsByGame(ctx, game._id);
    const players = await playersByGame(ctx, game._id);
    const team = teams[players.length % Math.max(teams.length, 1)] as Doc<"teams"> | undefined;
    const id = await ctx.db.insert("players", {
      game_id: game._id,
      name: args.playerName.trim() || `Player ${players.length + 1}`,
      is_host: false,
      team_id: game.team_assignment_mode === "auto" ? (team?._id ?? null) : null,
      has_submitted: false,
      created_at: nowIso()
    });
    const player = await ctx.db.get(id);
    if (!player) throw new Error("Could not join game.");

    if (game.prompt_mode === "deck") {
      await ensureDraftHand(ctx, game._id, player._id, game.cards_dealt_per_player, game.prompt_categories);
    }

    return { game: toGame(game), player: toPlayer(player) };
  }
});

export const loadSnapshot = query({
  args: { gameId },
  handler: async (ctx, args) => {
    return loadSnapshotForGame(ctx, args.gameId);
  }
});

export const updatePlayerName = mutation({
  args: { playerId, name: v.string() },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.playerId, { name: args.name.trim() || "Player" });
  }
});

export const assignPlayerToTeam = mutation({
  args: { playerId, teamId },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.playerId, { team_id: args.teamId });
  }
});

export const submitPrompts = mutation({
  args: { gameId, playerId, prompts: v.array(promptInput) },
  handler: async (ctx, args) => {
    const cleanPrompts = args.prompts
      .map((prompt) => {
        if (typeof prompt === "string") return { text: prompt.trim(), category: null as string | null };
        return { text: prompt.text.trim(), category: prompt.category?.trim() || null };
      })
      .filter((prompt) => prompt.text);
    const game = await requireGame(ctx, args.gameId);
    const prompts = await promptsByGame(ctx, game._id);
    const players = await playersByGame(ctx, game._id);
    const currentCount = game.play_mode === "pass_and_play" ? prompts.length : prompts.filter((prompt) => prompt.player_id === args.playerId).length;
    const requiredCount = game.play_mode === "pass_and_play" ? game.prompts_per_player * Math.max(players.length, 1) : game.prompts_per_player;
    const slotsLeft = Math.max(0, requiredCount - currentCount);
    const promptsToInsert = cleanPrompts.slice(0, slotsLeft);

    for (const prompt of promptsToInsert) {
      await ctx.db.insert("prompts", {
        game_id: game._id,
        player_id: args.playerId,
        text: prompt.text,
        category: prompt.category,
        description: null,
        status: "available",
        deck_order: null,
        created_at: nowIso()
      });
    }

    const nextPromptCount = currentCount + promptsToInsert.length;
    if (game.play_mode === "pass_and_play") {
      for (const player of players) {
        await ctx.db.patch(player._id, { has_submitted: nextPromptCount >= requiredCount });
      }
    } else {
      await ctx.db.patch(args.playerId, { has_submitted: nextPromptCount >= requiredCount });
    }
  }
});

export const setDraftCardSelected = mutation({
  args: { gameId, playerId, draftCardId, selected: v.boolean() },
  handler: async (ctx, args) => {
    const snapshot = await loadSnapshotForGame(ctx, args.gameId);
    if (snapshot.game.prompt_mode !== "deck") return;

    const currentSelectedCount = snapshot.draftCards.filter((card) => card.player_id === args.playerId && card.selected).length;
    const card = snapshot.draftCards.find((candidate) => candidate.id === args.draftCardId && candidate.player_id === args.playerId);
    if (!card) throw new Error("That card is not in your hand.");
    if (args.selected && !card.selected && currentSelectedCount >= snapshot.game.cards_kept_per_player) {
      throw new Error(`Choose only ${snapshot.game.cards_kept_per_player} cards.`);
    }

    await ctx.db.patch(args.draftCardId, { selected: args.selected });
    const nextSelectedCount = currentSelectedCount + (args.selected && !card.selected ? 1 : 0) - (!args.selected && card.selected ? 1 : 0);
    await ctx.db.patch(args.playerId, { has_submitted: nextSelectedCount >= snapshot.game.cards_kept_per_player });
  }
});

export const startGame = mutation({
  args: { gameId },
  handler: async (ctx, args) => {
    const snapshot = await loadSnapshotForGame(ctx, args.gameId);
    const unreadyPlayer = snapshot.players.find((player) => {
      if (!player.team_id) return true;
      if (snapshot.game.play_mode === "pass_and_play") return false;
      if (snapshot.game.prompt_mode === "deck") return !hasPlayerDrafted(player.id, snapshot);
      return !hasPlayerSubmitted(player.id, snapshot.prompts, snapshot.game.prompts_per_player);
    });

    if (unreadyPlayer) {
      throw new Error(`${unreadyPlayer.name} still needs a team and ${snapshot.game.prompt_mode === "deck" ? "cards" : "prompts"}.`);
    }

    if (snapshot.game.play_mode === "pass_and_play") {
      const requiredPromptCount =
        snapshot.game.prompt_mode === "deck"
          ? snapshot.game.pass_play_card_count
          : snapshot.players.length * snapshot.game.prompts_per_player;
      if (snapshot.prompts.length < requiredPromptCount) {
        throw new Error("Add enough pass-and-play prompts before starting.");
      }
    }

    const promptPool = snapshot.game.prompt_mode === "deck" ? await ensureDeckDraftPrompts(ctx, snapshot) : snapshot.prompts;
    const shuffledPrompts = shuffle(promptPool);
    const firstAssignment = getFirstTurnAssignment(snapshot);
    const firstPrompt = shuffledPrompts[0];
    if (!firstAssignment || !firstPrompt) throw new Error("Need at least one player and one prompt to start.");

    for (const [deckOrder, prompt] of shuffledPrompts.entries()) {
      await ctx.db.patch(prompt.id as Id<"prompts">, {
        deck_order: deckOrder,
        status: deckOrder === 0 ? "active" : "available"
      });
    }

    await ctx.db.patch(args.gameId, {
      phase: "ready",
      active_player_id: firstAssignment.player.id as Id<"players">,
      current_team_id: firstAssignment.team.id as Id<"teams">,
      current_prompt_id: firstPrompt.id as Id<"prompts">,
      turn_number: 1,
      round_number: 1,
      paused_at: null
    });
  }
});

export const startTurn = mutation({
  args: { gameId },
  handler: async (ctx, args) => {
    const snapshot = await loadSnapshotForGame(ctx, args.gameId);
    const activePlayer = snapshot.players.find((player) => player.id === snapshot.game.active_player_id);
    const team = snapshot.teams.find((candidate) => candidate.id === snapshot.game.current_team_id);
    if (!activePlayer || !team || !snapshot.game.current_prompt_id) {
      throw new Error("This turn is not ready to start yet.");
    }
    if (snapshot.activeTurn) {
      await ctx.db.patch(snapshot.activeTurn.id as Id<"turns">, { ended_at: nowIso() });
    }
    await ctx.db.insert("turns", {
      game_id: args.gameId,
      team_id: team.id as Id<"teams">,
      player_id: activePlayer.id as Id<"players">,
      started_at: nowIso(),
      ended_at: null,
      correct_count: 0,
      skip_count: 0
    });
    await ctx.db.patch(args.gameId, { phase: "playing", paused_at: null });
  }
});

export const pauseGame = mutation({
  args: { gameId },
  handler: async (ctx, args) => {
    const game = await requireGame(ctx, args.gameId);
    if (game.phase !== "playing") return;
    await ctx.db.patch(args.gameId, { phase: "paused", paused_at: nowIso() });
  }
});

export const resumeGame = mutation({
  args: { gameId },
  handler: async (ctx, args) => {
    const snapshot = await loadSnapshotForGame(ctx, args.gameId);
    if (snapshot.game.phase !== "paused") return;
    const pausedAt = snapshot.game.paused_at ? new Date(snapshot.game.paused_at).getTime() : Date.now();
    const pausedMilliseconds = Math.max(0, Date.now() - pausedAt);
    if (snapshot.activeTurn) {
      const adjustedStartedAt = new Date(new Date(snapshot.activeTurn.started_at).getTime() + pausedMilliseconds).toISOString();
      await ctx.db.patch(snapshot.activeTurn.id as Id<"turns">, { started_at: adjustedStartedAt });
    }
    await ctx.db.patch(args.gameId, { phase: "playing", paused_at: null });
  }
});

export const finishGame = mutation({
  args: { gameId },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.gameId, {
      phase: "finished",
      current_prompt_id: null,
      active_player_id: null,
      current_team_id: null,
      paused_at: null
    });
  }
});

export const resetToLobby = mutation({
  args: { gameId },
  handler: async (ctx, args) => {
    const turns = await turnsByGame(ctx, args.gameId);
    for (const turn of turns.filter((candidate) => candidate.ended_at === null)) {
      await ctx.db.patch(turn._id, { ended_at: nowIso() });
    }
    for (const prompt of await promptsByGame(ctx, args.gameId)) {
      await ctx.db.patch(prompt._id, { status: "available", deck_order: null });
    }
    for (const team of await teamsByGame(ctx, args.gameId)) {
      await ctx.db.patch(team._id, { score: 0 });
    }
    await ctx.db.patch(args.gameId, {
      phase: "lobby",
      current_prompt_id: null,
      active_player_id: null,
      current_team_id: null,
      paused_at: null,
      turn_number: 0,
      round_number: 1
    });
  }
});

export const undoLastAction = mutation({
  args: { gameId },
  handler: async (ctx, args) => {
    const snapshot = await loadSnapshotForGame(ctx, args.gameId);
    const event = snapshot.latestUndoableEvent;
    if (!event) throw new Error("Nothing to undo yet.");

    for (const team of event.payload.teams as Array<{ id: Id<"teams">; score: number }>) {
      await ctx.db.patch(team.id, { score: team.score });
    }
    for (const prompt of event.payload.prompts as Array<{ id: Id<"prompts">; status: "available" | "active" | "correct"; deck_order: number | null }>) {
      await ctx.db.patch(prompt.id, { status: prompt.status, deck_order: prompt.deck_order });
    }
    if (event.payload.activeTurn) {
      const activeTurn = event.payload.activeTurn as { id: Id<"turns">; ended_at: string | null; correct_count: number; skip_count: number };
      await ctx.db.patch(activeTurn.id, {
        ended_at: activeTurn.ended_at,
        correct_count: activeTurn.correct_count,
        skip_count: activeTurn.skip_count
      });
    }
    await ctx.db.patch(args.gameId, {
      phase: event.payload.game.phase,
      current_team_id: event.payload.game.current_team_id as Id<"teams"> | null,
      active_player_id: event.payload.game.active_player_id as Id<"players"> | null,
      current_prompt_id: event.payload.game.current_prompt_id as Id<"prompts"> | null,
      turn_number: event.payload.game.turn_number,
      round_number: event.payload.game.round_number,
      paused_at: event.payload.game.paused_at
    });
    await ctx.db.patch(event.id as Id<"game_events">, { undone_at: nowIso() });
  }
});

export const markCorrect = mutation({
  args: { gameId, ...actionStateArgs },
  handler: async (ctx, args) => {
    const snapshot = await loadSnapshotForGame(ctx, args.gameId);
    if (!snapshotMatchesActionState(snapshot, args)) return;
    const promptId = snapshot.game.current_prompt_id as Id<"prompts"> | null;
    const teamId = snapshot.game.current_team_id as Id<"teams"> | null;
    if (!promptId || !teamId) return;
    const prompt = await ctx.db.get(promptId);
    if (!prompt || prompt.status !== "active" || prompt.game_id !== args.gameId) return;

    await recordUndoPoint(ctx, snapshot, "correct");
    await ctx.db.patch(promptId, { status: "correct" });
    const team = await ctx.db.get(teamId);
    if (team) await ctx.db.patch(teamId, { score: team.score + 1 });
    if (snapshot.activeTurn) {
      await ctx.db.patch(snapshot.activeTurn.id as Id<"turns">, { correct_count: snapshot.activeTurn.correct_count + 1 });
    }

    const nextPrompt = await activateNextPrompt(ctx, args.gameId);
    if (!nextPrompt) {
      await prepareNextRound(ctx, snapshot);
    }
  }
});

export const skipPrompt = mutation({
  args: { gameId, ...actionStateArgs },
  handler: async (ctx, args) => {
    const snapshot = await loadSnapshotForGame(ctx, args.gameId);
    if (!snapshotMatchesActionState(snapshot, args)) return;
    const promptId = snapshot.game.current_prompt_id as Id<"prompts"> | null;
    if (!promptId) return;
    const prompt = await ctx.db.get(promptId);
    if (!prompt || prompt.status !== "active" || prompt.game_id !== args.gameId) return;
    const hasNextPrompt = snapshot.prompts.some((candidate) => candidate.status === "available");
    if (!hasNextPrompt) return;

    await recordUndoPoint(ctx, snapshot, "skip");
    const maxDeckOrder = Math.max(0, ...snapshot.prompts.map((candidate) => candidate.deck_order ?? 0));
    await ctx.db.patch(promptId, { status: "available", deck_order: maxDeckOrder + 1 });
    if (snapshot.activeTurn) {
      await ctx.db.patch(snapshot.activeTurn.id as Id<"turns">, { skip_count: snapshot.activeTurn.skip_count + 1 });
    }
    await activateNextPrompt(ctx, args.gameId, promptId);
  }
});

export const endTurn = mutation({
  args: { gameId },
  handler: async (ctx, args) => {
    const snapshot = await loadSnapshotForGame(ctx, args.gameId);
    if (snapshot.game.phase !== "playing" || !snapshot.activeTurn) return;
    await recordUndoPoint(ctx, snapshot, "end_turn");
    await ctx.db.patch(snapshot.activeTurn.id as Id<"turns">, { ended_at: nowIso() });

    const activePromptId = snapshot.game.current_prompt_id as Id<"prompts"> | null;
    if (activePromptId) {
      const prompt = await ctx.db.get(activePromptId);
      if (prompt?.status === "active") await ctx.db.patch(activePromptId, { status: "available" });
    }

    const nextAssignment = getNextTurnAssignment(snapshot);
    const reusablePrompts = snapshot.prompts
      .filter((prompt) => prompt.status === "available" || prompt.id === activePromptId)
      .sort((a, b) => (a.deck_order ?? 9999) - (b.deck_order ?? 9999));
    const nextPrompt = reusablePrompts.find((prompt) => prompt.id !== activePromptId) ?? reusablePrompts[0] ?? null;

    if (!nextAssignment || !nextPrompt) {
      await ctx.db.patch(args.gameId, {
        phase: "finished",
        current_prompt_id: null,
        active_player_id: null,
        current_team_id: null,
        paused_at: null
      });
      return;
    }

    await ctx.db.patch(nextPrompt.id as Id<"prompts">, { status: "active" });
    await ctx.db.patch(args.gameId, {
      phase: "ready",
      active_player_id: nextAssignment.player.id as Id<"players">,
      current_team_id: nextAssignment.team.id as Id<"teams">,
      current_prompt_id: nextPrompt.id as Id<"prompts">,
      turn_number: snapshot.game.turn_number + 1,
      paused_at: null
    });
  }
});

async function requireGame(ctx: QueryOrMutationCtx, id: Id<"games">) {
  const game = await ctx.db.get(id);
  if (!game) throw new Error("Game not found.");
  return game;
}

async function loadSnapshotForGame(ctx: QueryOrMutationCtx, id: Id<"games">): Promise<GameSnapshot> {
  const game = await requireGame(ctx, id);
  const [players, teams, prompts, draftCards, turns, events] = await Promise.all([
    playersByGame(ctx, id),
    teamsByGame(ctx, id),
    promptsByGame(ctx, id),
    draftCardsByGame(ctx, id),
    turnsByGame(ctx, id),
    eventsByGame(ctx, id)
  ]);

  const activeTurn = turns
    .filter((turn) => turn.ended_at === null)
    .sort((a, b) => b.started_at.localeCompare(a.started_at))[0] ?? null;
  const latestUndoableEvent = events
    .filter((event) => event.undone_at === null)
    .sort((a, b) => b.created_at.localeCompare(a.created_at))[0] ?? null;

  return {
    game: toGame(game),
    players: players.map(toPlayer).sort((a, b) => a.created_at.localeCompare(b.created_at)),
    teams: teams.map(toTeam).sort((a, b) => a.sort_order - b.sort_order),
    prompts: prompts.map(toPrompt).sort((a, b) => (a.deck_order ?? 9999) - (b.deck_order ?? 9999)),
    draftCards: draftCards.map(toDraftCard).filter((card) => isStarterDeckCardAllowed(card.card_id)).sort((a, b) => a.sort_order - b.sort_order),
    activeTurn: activeTurn ? toTurn(activeTurn) : null,
    latestUndoableEvent: latestUndoableEvent ? toGameEvent(latestUndoableEvent) : null
  };
}

async function ensureDraftHand(
  ctx: MutationCtx,
  game_id: Id<"games">,
  player_id: Id<"players">,
  cardsToDeal: number,
  selectedCategories: string[]
) {
  const existingPlayerCards = await ctx.db
    .query("draft_cards")
    .withIndex("by_game_player", (q) => q.eq("game_id", game_id).eq("player_id", player_id))
    .collect();

  const invalidPlayerCards = existingPlayerCards.filter((card) => !isStarterDeckCardAllowed(card.card_id));
  for (const card of invalidPlayerCards) {
    await ctx.db.delete(card._id);
  }

  const validPlayerCards = existingPlayerCards.filter((card) => isStarterDeckCardAllowed(card.card_id));
  if (validPlayerCards.length >= cardsToDeal) return;

  const existingCards = await draftCardsByGame(ctx, game_id);
  const usedIds = new Set(existingCards.map((card) => card.card_id));
  const categoryCards = filterStarterDeckByCategories(selectedCategories);
  const unusedCards = categoryCards.filter((card) => !usedIds.has(card.id));
  const cardsNeeded = cardsToDeal - validPlayerCards.length;
  const sourceCards = unusedCards.length >= cardsNeeded ? unusedCards : categoryCards;
  const hand = shuffle(sourceCards).slice(0, cardsNeeded);
  const nextSortOrder = validPlayerCards.reduce((max, card) => Math.max(max, card.sort_order), -1) + 1;

  for (const [sort_order, card] of hand.entries()) {
    await ctx.db.insert("draft_cards", {
      game_id,
      player_id,
      card_id: card.id,
      title: card.title,
      description: card.description,
      selected: false,
      sort_order: nextSortOrder + sort_order,
      created_at: nowIso()
    });
  }
}

async function ensureDeckDraftPrompts(ctx: MutationCtx, snapshot: GameSnapshot) {
  if (snapshot.prompts.length > 0) return snapshot.prompts;
  const selectedCards = snapshot.draftCards.filter((card) => card.selected);
  if (selectedCards.length === 0) throw new Error("Choose at least one card before starting.");

  const prompts = [];
  for (const card of selectedCards) {
    const id = await ctx.db.insert("prompts", {
      game_id: card.game_id as Id<"games">,
      player_id: card.player_id as Id<"players">,
      text: card.title,
      description: card.description,
      category: "Deck Draft",
      status: "available",
      deck_order: null,
      created_at: nowIso()
    });
    const prompt = await ctx.db.get(id);
    if (prompt) prompts.push(toPrompt(prompt));
  }
  return prompts;
}

async function recordUndoPoint(ctx: MutationCtx, snapshot: GameSnapshot, action: "correct" | "skip" | "end_turn") {
  await ctx.db.insert("game_events", {
    game_id: snapshot.game.id as Id<"games">,
    action,
    payload: {
      game: {
        phase: snapshot.game.phase,
        current_team_id: snapshot.game.current_team_id,
        active_player_id: snapshot.game.active_player_id,
        current_prompt_id: snapshot.game.current_prompt_id,
        turn_number: snapshot.game.turn_number,
        round_number: snapshot.game.round_number,
        paused_at: snapshot.game.paused_at
      },
      teams: snapshot.teams.map((team) => ({ id: team.id, score: team.score })),
      prompts: snapshot.prompts.map((prompt) => ({ id: prompt.id, status: prompt.status, deck_order: prompt.deck_order })),
      activeTurn: snapshot.activeTurn
        ? {
            id: snapshot.activeTurn.id,
            ended_at: snapshot.activeTurn.ended_at,
            correct_count: snapshot.activeTurn.correct_count,
            skip_count: snapshot.activeTurn.skip_count
          }
        : null
    },
    undone_at: null,
    created_at: nowIso()
  });
}

function snapshotMatchesActionState(
  snapshot: GameSnapshot,
  args: {
    expectedPromptId: Id<"prompts"> | null;
    expectedTeamId: Id<"teams"> | null;
    expectedActivePlayerId: Id<"players"> | null;
    expectedTurnNumber: number;
  }
) {
  return (
    snapshot.game.phase === "playing" &&
    snapshot.game.current_prompt_id === args.expectedPromptId &&
    snapshot.game.current_team_id === args.expectedTeamId &&
    snapshot.game.active_player_id === args.expectedActivePlayerId &&
    snapshot.game.turn_number === args.expectedTurnNumber
  );
}

async function activateNextPrompt(ctx: MutationCtx, game_id: Id<"games">, excludePromptId?: Id<"prompts">) {
  const promptList = (await promptsByGame(ctx, game_id))
    .filter((prompt) => prompt.status === "available")
    .sort((a, b) => (a.deck_order ?? 9999) - (b.deck_order ?? 9999));
  const nextPrompt = promptList.find((prompt) => prompt._id !== excludePromptId) ?? promptList[0] ?? null;
  if (!nextPrompt) return null;
  await ctx.db.patch(nextPrompt._id, { status: "active" });
  await ctx.db.patch(game_id, { current_prompt_id: nextPrompt._id });
  return nextPrompt;
}

async function prepareNextRound(ctx: MutationCtx, snapshot: GameSnapshot) {
  if (snapshot.activeTurn) {
    await ctx.db.patch(snapshot.activeTurn.id as Id<"turns">, { ended_at: nowIso() });
  }
  const id = snapshot.game.id as Id<"games">;
  if (isFinalRound(snapshot.game.round_number)) {
    await ctx.db.patch(id, {
      phase: "finished",
      current_prompt_id: null,
      active_player_id: null,
      current_team_id: null,
      paused_at: null
    });
    return;
  }

  const nextRoundNumber = snapshot.game.round_number + 1;
  const shuffledPrompts = shuffle(snapshot.prompts);
  const firstPrompt = shuffledPrompts[0];
  const nextAssignment = getNextTurnAssignment(snapshot);
  if (!firstPrompt || !nextAssignment) {
    await ctx.db.patch(id, {
      phase: "finished",
      current_prompt_id: null,
      active_player_id: null,
      current_team_id: null,
      paused_at: null
    });
    return;
  }

  for (const [deckOrder, prompt] of shuffledPrompts.entries()) {
    await ctx.db.patch(prompt.id as Id<"prompts">, {
      deck_order: deckOrder,
      status: deckOrder === 0 ? "active" : "available"
    });
  }

  await ctx.db.patch(id, {
    phase: "ready",
    active_player_id: nextAssignment.player.id as Id<"players">,
    current_team_id: nextAssignment.team.id as Id<"teams">,
    current_prompt_id: firstPrompt.id as Id<"prompts">,
    round_number: nextRoundNumber,
    turn_number: snapshot.game.turn_number + 1,
    paused_at: null
  });
}

async function getHostPlayer(ctx: QueryOrMutationCtx, id: Id<"games">) {
  const players = await playersByGame(ctx, id);
  return players.find((player) => player.is_host) ?? null;
}

async function deleteByGame(ctx: MutationCtx, table: "prompts" | "draft_cards" | "teams", id: Id<"games">) {
  const rows = await ctx.db
    .query(table)
    .withIndex("by_game", (q) => q.eq("game_id", id))
    .collect();
  for (const row of rows) {
    await ctx.db.delete(row._id);
  }
}

async function playersByGame(ctx: QueryOrMutationCtx, id: Id<"games">) {
  return ctx.db.query("players").withIndex("by_game", (q) => q.eq("game_id", id)).collect();
}

async function teamsByGame(ctx: QueryOrMutationCtx, id: Id<"games">) {
  return ctx.db.query("teams").withIndex("by_game", (q) => q.eq("game_id", id)).collect();
}

async function promptsByGame(ctx: QueryOrMutationCtx, id: Id<"games">) {
  return ctx.db.query("prompts").withIndex("by_game", (q) => q.eq("game_id", id)).collect();
}

async function draftCardsByGame(ctx: QueryOrMutationCtx, id: Id<"games">) {
  return ctx.db.query("draft_cards").withIndex("by_game", (q) => q.eq("game_id", id)).collect();
}

async function turnsByGame(ctx: QueryOrMutationCtx, id: Id<"games">) {
  return ctx.db.query("turns").withIndex("by_game", (q) => q.eq("game_id", id)).collect();
}

async function eventsByGame(ctx: QueryOrMutationCtx, id: Id<"games">) {
  return ctx.db.query("game_events").withIndex("by_game", (q) => q.eq("game_id", id)).collect();
}

function clampRound(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, Math.round(value)));
}

function toGame(doc: Doc<"games">) {
  return { ...stripDoc(doc), id: doc._id };
}

function toPlayer(doc: Doc<"players">) {
  return { ...stripDoc(doc), id: doc._id };
}

function toTeam(doc: Doc<"teams">): Team {
  return { id: doc._id, game_id: doc.game_id, name: doc.name, score: doc.score, sort_order: doc.sort_order };
}

function toPrompt(doc: Doc<"prompts">) {
  return { ...stripDoc(doc), id: doc._id };
}

function toDraftCard(doc: Doc<"draft_cards">) {
  return { ...stripDoc(doc), id: doc._id };
}

function toTurn(doc: Doc<"turns">) {
  return { ...stripDoc(doc), id: doc._id };
}

function toGameEvent(doc: Doc<"game_events">) {
  return { ...stripDoc(doc), id: doc._id };
}

function stripDoc<T extends { _id: string; _creationTime: number }>(doc: T) {
  const { _id, _creationTime, ...rest } = doc;
  void _id;
  void _creationTime;
  return rest;
}

type QueryOrMutationCtx = QueryCtx | MutationCtx;
