import { findViewer, hashSessionToken, requireController, requireHost, requirePlayer } from "./access";
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
  getPromptForPlayerTurn,
  getRandomFirstTurnAssignment,
  getNextTurnAssignment,
  hasPlayerDrafted,
  hasPlayerSubmitted,
  isFinalRound,
  shuffle
} from "../lib/game-utils";
import type { GameEvent, GameSnapshot, PlayMode, PromptMode, Team } from "../lib/types";

type FullGameSnapshot = Omit<GameSnapshot, "latestUndoableEvent"> & { latestUndoableEvent: GameEvent | null };
const sessionToken = v.string();
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

const matchArgs = { gameId, sessionToken, expectedMatchNumber: v.number() };
const actionStateArgs = {
  expectedTurnId: v.union(v.id("turns"), v.null()),
  expectedPromptId: v.union(promptId, v.null()),
  expectedTeamId: v.union(teamId, v.null()),
  expectedActivePlayerId: v.union(playerId, v.null()),
  expectedTurnNumber: v.number()
};

export const createGame = mutation({
  args: { hostName: v.string(), sessionToken },
  handler: async (ctx, args) => {
    const hash = await hashSessionToken(args.sessionToken);
    const existingHost = await ctx.db.query("players").withIndex("by_session", (q) => q.eq("session_token_hash", hash)).unique();
    if (existingHost?.is_host) {
      const existingGame = await requireGame(ctx, existingHost.game_id);
      return { game: toGame(existingGame), player: toPlayer(existingHost) };
    }
    if (existingHost) throw new Error("Use a new session for this game.");
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
        access_version: 2,
        match_number: 1,
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
      session_token_hash: hash,
      name: args.hostName.trim().slice(0, 60) || "Host",
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
    sessionToken,
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
    await requireHost(ctx, args.gameId, args.sessionToken);
    requirePhase(game.phase, ["setup", "lobby"]);
    const cleanPromptsPerPlayer = clampRound(args.promptsPerPlayer, 1, 20);
    const cleanCardsDealtPerPlayer = clampRound(args.cardsDealtPerPlayer, 1, 20);
    const cleanCardsKeptPerPlayer = Math.min(cleanCardsDealtPerPlayer, clampRound(args.cardsKeptPerPlayer, 1, 20));
    const cleanTeamNames = args.teamNames.map((name, index) => name.trim().slice(0, 60) || `Team ${index + 1}`).slice(0, 12);
    const cleanPlayMode: PlayMode = args.playMode === "pass_and_play" ? "pass_and_play" : DEFAULT_PLAY_MODE;
    const cleanPromptMode: PromptMode = args.promptMode;
    const cleanPassAndPlayPlayers = args.passAndPlayPlayers
      .map((player, index) => ({
        name: player.name.trim().slice(0, 60) || `Player ${index + 1}`,
        teamIndex: Math.max(0, Math.round(player.teamIndex || 0))
      }))
      .slice(0, 40);
    const cleanPassPlayCardCount = clampRound(args.passPlayCardCount, 10, 80);
    const cleanPromptCategories = args.promptCategories.length > 0 ? args.promptCategories : [MIXED_PASS_PLAY_CATEGORY];
    const cleanExpectedPlayers = args.expectedPlayers ? clampRound(args.expectedPlayers, 1, 200) : null;
    const cleanTurnDurationSeconds = TURN_DURATION_OPTIONS.includes(args.turnDurationSeconds as (typeof TURN_DURATION_OPTIONS)[number])
      ? args.turnDurationSeconds
      : TURN_DURATION_SECONDS;

    const categories = cleanPlayMode === "pass_and_play" ? args.passPlayCategories : cleanPromptCategories;
    if (cleanPromptMode === "deck") {
      const capacity = filterStarterDeckByCategories(categories).length;
      const currentPlayers = await playersByGame(ctx, game._id);
      const needed = cleanPlayMode === "pass_and_play" ? cleanPassPlayCardCount : Math.max(currentPlayers.length, cleanExpectedPlayers ?? 1) * cleanCardsDealtPerPlayer;
      if (needed > capacity) throw new Error(`These categories have ${capacity} unique cards. Choose fewer cards or add categories before creating the lobby.`);
    }
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
      const allPlayers = await playersByGame(ctx, game._id);
      const existingPlayers = allPlayers.filter((player) => player.session_token_hash || player.is_host);
      for (const player of allPlayers.filter((player) => !player.session_token_hash && !player.is_host)) await ctx.db.delete(player._id);
      for (const [index, player] of existingPlayers.entries()) {
        await ctx.db.patch(player._id, { team_id: player.is_host || args.teamAssignmentMode === "auto" ? teams[index % teams.length]._id : null, has_submitted: false });
      }
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
  args: { code: v.string(), playerName: v.string(), sessionToken },
  handler: async (ctx, args) => {
    const game = await ctx.db
      .query("games")
      .withIndex("by_code", (q) => q.eq("code", args.code.trim().toUpperCase()))
      .unique();

    if (!game) throw new Error("No game found for that code.");
    const hash = await hashSessionToken(args.sessionToken);
    const existing = await findViewer(ctx, game._id, args.sessionToken);
    if (existing) return { game: toGame(game), player: toPlayer(existing) };
    if (game.access_version !== 2) throw new Error("This older room has retired. Create a new game to use secure player sessions.");
    if (game.phase === "setup") throw new Error("The host is still setting up this game.");
    if (game.play_mode === "pass_and_play") throw new Error("This game is in Pass & Play mode. Use the host phone.");

    const teams = await teamsByGame(ctx, game._id);
    const players = await playersByGame(ctx, game._id);
    requirePhase(game.phase, ["lobby"]);
    if (players.length >= 200) throw new Error("This room is full.");
    const team = [...teams].sort((a, b) => players.filter((p) => p.team_id === a._id).length - players.filter((p) => p.team_id === b._id).length)[0];
    const id = await ctx.db.insert("players", {
      game_id: game._id,
      session_token_hash: hash,
      name: args.playerName.trim().slice(0, 60) || `Player ${players.length + 1}`,
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
  args: { gameId: v.string(), sessionToken: v.optional(v.string()) },
  handler: async (ctx, args): Promise<GameSnapshot | null> => {
    const id = ctx.db.normalizeId("games", args.gameId);
    const game = id ? await ctx.db.get(id) : null;
    if (!game) return null;
    const viewer = await findViewer(ctx, game._id, args.sessionToken);
    if (!viewer) return { game: toGame(game), players: [], teams: [], prompts: [], draftCards: [], activeTurn: null, latestUndoableEvent: null, viewer_player_id: null, server_now: Date.now() };
    const snapshot = await loadSnapshotForGame(ctx, game._id);
    const controlsTurn = game.active_player_id === viewer._id || (game.play_mode === "pass_and_play" && game.host_player_id === viewer._id);
    return {
      ...snapshot,
      viewer_player_id: viewer._id,
      server_now: Date.now(),
      players: snapshot.players.map((player) => ({ ...player, draft_selected_count: snapshot.draftCards.filter((card) => card.player_id === player.id && card.selected).length })),
      // Keep counts/statuses available without exposing the bowl's contents.
      prompts: snapshot.prompts.map((prompt) => {
        const ownSubmission = game.phase === "lobby" && game.prompt_mode !== "deck" && prompt.player_id === viewer._id;
        const currentCard = game.phase === "playing" && controlsTurn && prompt.id === game.current_prompt_id;
        return ownSubmission || currentCard ? prompt : { ...prompt, text: "", description: null, category: null };
      }),
      draftCards: game.phase === "lobby" ? snapshot.draftCards.filter((card) => card.player_id === viewer._id) : [],
      latestUndoableEvent: viewer.is_host && snapshot.latestUndoableEvent ? { id: snapshot.latestUndoableEvent.id, action: snapshot.latestUndoableEvent.action } : null
    };
  }
});

// A one-shot mutation avoids cached query timestamps when a phone reconnects.
export const synchronizeClock = mutation({
  args: { gameId, sessionToken },
  handler: async (ctx, args) => {
    await requirePlayer(ctx, args.gameId, args.sessionToken);
    return Date.now();
  }
});

export const updatePlayerName = mutation({
  args: { gameId, sessionToken, playerId, name: v.string() },
  handler: async (ctx, args) => {
    const viewer = await requirePlayer(ctx, args.gameId, args.sessionToken);
    if (viewer._id !== args.playerId) throw new Error("You can only rename yourself.");
    await ctx.db.patch(args.playerId, { name: args.name.trim().slice(0, 60) || "Player" });
  }
});

export const assignPlayerToTeam = mutation({
  args: { gameId, sessionToken, playerId, teamId },
  handler: async (ctx, args) => {
    const viewer = await requirePlayer(ctx, args.gameId, args.sessionToken);
    const game = await requireGame(ctx, args.gameId);
    requirePhase(game.phase, ["lobby"]);
    const player = await ctx.db.get(args.playerId);
    const team = await ctx.db.get(args.teamId);
    if (!player || player.game_id !== args.gameId || !team || team.game_id !== args.gameId) throw new Error("Choose a player and team in this room.");
    if (!viewer.is_host && (viewer._id !== args.playerId || game.team_assignment_mode !== "choose")) throw new Error("Only the host can assign that team.");
    await ctx.db.patch(args.playerId, { team_id: args.teamId });
  }
});

export const submitPrompts = mutation({
  args: { gameId, sessionToken, playerId, prompts: v.array(promptInput) },
  handler: async (ctx, args) => {
    const viewer = await requirePlayer(ctx, args.gameId, args.sessionToken);
    if (viewer._id !== args.playerId) throw new Error("You can only submit your own prompts.");
    if (args.prompts.length > 800) throw new Error("Too many prompts.");
    const cleanPrompts = args.prompts
      .map((prompt) => {
        if (typeof prompt === "string") return { text: prompt.trim(), category: null as string | null };
        return { text: prompt.text.trim(), category: prompt.category?.trim() || null };
      })
      .filter((prompt) => prompt.text);
    if (cleanPrompts.some((prompt) => prompt.text.length > 120)) throw new Error("Keep each prompt to 120 characters.");
    const game = await requireGame(ctx, args.gameId);
    requirePhase(game.phase, ["lobby"]);
    if (game.prompt_mode === "deck") throw new Error("Choose cards from your hand for this game.");
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
  args: { gameId, sessionToken, playerId, draftCardId, selected: v.boolean() },
  handler: async (ctx, args) => {
    const viewer = await requirePlayer(ctx, args.gameId, args.sessionToken);
    if (viewer._id !== args.playerId) throw new Error("You can only select your own cards.");
    const snapshot = await loadSnapshotForGame(ctx, args.gameId);
    requirePhase(snapshot.game.phase, ["lobby"]);
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
  args: { ...matchArgs },
  handler: async (ctx, args) => {
    await requireHost(ctx, args.gameId, args.sessionToken);
    if (!await matchesMatch(ctx, args.gameId, args.expectedMatchNumber)) return;
    const snapshot = await loadSnapshotForGame(ctx, args.gameId);
    if (snapshot.game.phase !== "lobby") return;
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
    const firstAssignment = getRandomFirstTurnAssignment(snapshot);
    const firstPrompt = firstAssignment ? getPromptForPlayerTurn(shuffledPrompts, firstAssignment.player.id) : null;
    if (!firstAssignment || !firstPrompt) throw new Error("Need at least one player and one prompt to start.");

    for (const [deckOrder, prompt] of shuffledPrompts.entries()) {
      await ctx.db.patch(prompt.id as Id<"prompts">, {
        deck_order: deckOrder,
        status: prompt.id === firstPrompt.id ? "active" : "available"
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
  args: { ...matchArgs, expectedTurnNumber: v.number() },
  handler: async (ctx, args) => {
    const snapshot = await loadSnapshotForGame(ctx, args.gameId);
    await requireController(ctx, args.gameId, args.sessionToken);
    if (snapshot.game.phase !== "ready" || snapshot.game.turn_number !== args.expectedTurnNumber || (snapshot.game.match_number ?? 1) !== args.expectedMatchNumber) return;
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
  args: { ...matchArgs },
  handler: async (ctx, args) => {
    await requireHost(ctx, args.gameId, args.sessionToken);
    if (!await matchesMatch(ctx, args.gameId, args.expectedMatchNumber)) return;
    const game = await requireGame(ctx, args.gameId);
    if (game.phase !== "playing") return;
    const snapshot = await loadSnapshotForGame(ctx, args.gameId);
    if (turnExpired(snapshot)) { await endTurnForSnapshot(ctx, snapshot); return; }
    await ctx.db.patch(args.gameId, { phase: "paused", paused_at: nowIso() });
  }
});

export const resumeGame = mutation({
  args: { ...matchArgs },
  handler: async (ctx, args) => {
    await requireHost(ctx, args.gameId, args.sessionToken);
    if (!await matchesMatch(ctx, args.gameId, args.expectedMatchNumber)) return;
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
  args: { ...matchArgs },
  handler: async (ctx, args) => {
    await requireHost(ctx, args.gameId, args.sessionToken);
    if (!await matchesMatch(ctx, args.gameId, args.expectedMatchNumber)) return;
    const game = await requireGame(ctx, args.gameId);
    requirePhase(game.phase, ["ready", "playing", "paused", "finished"]);
    for (const turn of await turnsByGame(ctx, args.gameId)) {
      if (turn.ended_at === null) await ctx.db.patch(turn._id, { ended_at: nowIso() });
    }
    await ctx.db.patch(args.gameId, {
      finish_reason: "host",
      phase: "finished",
      current_prompt_id: null,
      active_player_id: null,
      current_team_id: null,
      paused_at: null
    });
  }
});

export const resetToLobby = mutation({
  args: { ...matchArgs, freshCards: v.boolean() },
  handler: async (ctx, args) => {
    await requireHost(ctx, args.gameId, args.sessionToken);
    if (!await matchesMatch(ctx, args.gameId, args.expectedMatchNumber)) return;
    const game = await requireGame(ctx, args.gameId);
    requirePhase(game.phase, ["ready", "playing", "paused", "finished"]);
    const prompts = await promptsByGame(ctx, args.gameId);
    const drafts = await draftCardsByGame(ctx, args.gameId);
    for (const event of await eventsByGame(ctx, args.gameId)) await ctx.db.delete(event._id);
    if (args.freshCards) {
      const previousTitles = [...new Set([...prompts.map((p) => p.text), ...drafts.map((c) => c.title)])];
      await ctx.db.patch(args.gameId, { previous_card_titles: previousTitles });
      await deleteByGame(ctx, "prompts", args.gameId);
      await deleteByGame(ctx, "draft_cards", args.gameId);
      for (const player of await playersByGame(ctx, args.gameId)) {
        await ctx.db.patch(player._id, { has_submitted: game.play_mode === "pass_and_play" && game.prompt_mode === "deck" });
        if (game.prompt_mode === "deck" && game.play_mode === "multi_device") await ensureDraftHand(ctx, args.gameId, player._id, game.cards_dealt_per_player, game.prompt_categories);
      }
      if (game.prompt_mode === "deck" && game.play_mode === "pass_and_play" && game.host_player_id) {
        const pool = filterStarterDeckByCategories(game.prompt_categories);
        const previous = new Set(previousTitles);
        const deck = [...shuffle(pool.filter((c) => !previous.has(c.title))), ...shuffle(pool.filter((c) => previous.has(c.title)))].slice(0, game.pass_play_card_count);
        for (const card of deck) await ctx.db.insert("prompts", { game_id: args.gameId, player_id: game.host_player_id, text: card.title, description: card.description, category: card.category, status: "available", deck_order: null, created_at: nowIso() });
      }
    }
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
      match_number: (game.match_number ?? 1) + 1,
      finish_reason: undefined,
      current_prompt_id: null,
      active_player_id: null,
      current_team_id: null,
      paused_at: null,
      turn_number: 0,
      round_number: 1
    });
  }
});

export const adjustTeamScore = mutation({
  args: { ...matchArgs, teamId, delta: v.number() },
  handler: async (ctx, args) => {
    await requireHost(ctx, args.gameId, args.sessionToken);
    if (!await matchesMatch(ctx, args.gameId, args.expectedMatchNumber)) return;
    const game = await requireGame(ctx, args.gameId);
    requirePhase(game.phase, ["ready", "playing", "paused", "finished"]);
    if (args.delta !== 1 && args.delta !== -1) throw new Error("Adjust the score one point at a time.");
    // Score overrides invalidate historical snapshots that would overwrite this correction.
    for (const event of await eventsByGame(ctx, args.gameId)) {
      if (!event.undone_at) await ctx.db.patch(event._id, { undone_at: nowIso() });
    }
    const team = await ctx.db.get(args.teamId);
    if (!team || team.game_id !== args.gameId) return;

    const nextScore = Math.max(0, team.score + Math.round(args.delta));
    await ctx.db.patch(args.teamId, { score: nextScore });
  }
});

export const redoLastFivePrompts = mutation({
  args: { ...matchArgs },
  handler: async (ctx, args) => {
    await requireHost(ctx, args.gameId, args.sessionToken);
    if (!await matchesMatch(ctx, args.gameId, args.expectedMatchNumber)) return;
    const snapshot = await loadSnapshotForGame(ctx, args.gameId);
    if (snapshot.game.phase !== "paused" && snapshot.game.phase !== "ready") return;

    const undoableEvents = (await ctx.db.query("game_events").withIndex("by_game", (q) => q.eq("game_id", args.gameId)).collect())
      .filter((event) => event.undone_at === null)
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
    const latestEvent = undoableEvents[0] ?? null;
    const targetTurnId =
      snapshot.activeTurn?.id ??
      (latestEvent?.action === "end_turn" && latestEvent.payload.activeTurn ? latestEvent.payload.activeTurn.id : null);
    const targetRoundNumber =
      latestEvent?.action === "end_turn" && latestEvent.payload.activeTurn ? latestEvent.payload.game.round_number : snapshot.game.round_number;
    if (!targetTurnId) return;

    const sameTurnEvents = undoableEvents.filter(
      (event) => event.payload.activeTurn?.id === targetTurnId && event.payload.game.round_number === targetRoundNumber
    );
    const closingTurnEvent = sameTurnEvents.find((event) => event.action === "end_turn") ?? null;
    const promptEvents = sameTurnEvents.filter((event) => event.action === "correct" || event.action === "skip").slice(0, 5);
    const eventsToUndo = closingTurnEvent ? [closingTurnEvent, ...promptEvents] : promptEvents;
    const restoreEvent = eventsToUndo[eventsToUndo.length - 1] ?? closingTurnEvent;

    if (!restoreEvent?.payload.activeTurn) {
      await restorePausedTurnTime(ctx, args.gameId, targetTurnId as Id<"turns">, snapshot.game.turn_duration_seconds);
      return;
    }

    await restoreGameEventState(ctx, args.gameId, restoreEvent as Doc<"game_events">);
    for (const event of eventsToUndo) {
      await ctx.db.patch(event._id, { undone_at: nowIso() });
    }
    await restorePausedTurnTime(ctx, args.gameId, targetTurnId as Id<"turns">, snapshot.game.turn_duration_seconds);
  }
});

export const undoLastAction = mutation({
  args: { ...matchArgs },
  handler: async (ctx, args) => {
    await requireHost(ctx, args.gameId, args.sessionToken);
    if (!await matchesMatch(ctx, args.gameId, args.expectedMatchNumber)) return;
    const snapshot = await loadSnapshotForGame(ctx, args.gameId);
    requirePhase(snapshot.game.phase, ["playing", "paused", "ready", "finished"]);
    const event = snapshot.latestUndoableEvent;
    if (!event) throw new Error("Nothing to undo yet.");

    await restoreGameEventState(ctx, args.gameId, event);
    // Close any newer turn before reopening the captured turn. Never run two clocks.
    for (const turn of await turnsByGame(ctx, args.gameId)) {
      if (turn.ended_at === null && turn._id !== event.payload.activeTurn?.id) await ctx.db.patch(turn._id, { ended_at: nowIso() });
    }
    if (event.payload.activeTurn) {
      const turn = await ctx.db.get(event.payload.activeTurn.id as Id<"turns">);
      const remainingAt = event.payload.game.paused_at ?? event.created_at;
      const remaining = turn ? Math.min(snapshot.game.turn_duration_seconds * 1_000, Math.max(1_000, snapshot.game.turn_duration_seconds * 1_000 - (Date.parse(remainingAt) - Date.parse(event.payload.activeTurn.started_at ?? turn.started_at)))) : 15_000;
      const now = Date.now();
      await ctx.db.patch(event.payload.activeTurn.id as Id<"turns">, { started_at: new Date(now - snapshot.game.turn_duration_seconds * 1_000 + remaining).toISOString(), ended_at: null });
      await ctx.db.patch(args.gameId, { phase: "paused", paused_at: new Date(now).toISOString() });
    }
    await ctx.db.patch(event.id as Id<"game_events">, { undone_at: nowIso() });
  }
});

export const markCorrect = mutation({
  args: { ...matchArgs, ...actionStateArgs },
  handler: async (ctx, args) => {
    const snapshot = await loadSnapshotForGame(ctx, args.gameId);
    await requireController(ctx, args.gameId, args.sessionToken);
    if (!snapshotMatchesActionState(snapshot, args)) return;
    if (turnExpired(snapshot)) { await endTurnForSnapshot(ctx, snapshot); return; }
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

    const nextPrompt = await activateNextPrompt(ctx, args.gameId, null, snapshot.game.active_player_id);
    if (!nextPrompt) {
      await prepareNextRound(ctx, snapshot);
    }
  }
});

export const skipPrompt = mutation({
  args: { ...matchArgs, ...actionStateArgs },
  handler: async (ctx, args) => {
    const snapshot = await loadSnapshotForGame(ctx, args.gameId);
    await requireController(ctx, args.gameId, args.sessionToken);
    if (!snapshotMatchesActionState(snapshot, args)) return;
    if (turnExpired(snapshot)) { await endTurnForSnapshot(ctx, snapshot); return; }
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
    await activateNextPrompt(ctx, args.gameId, promptId, snapshot.game.active_player_id);
  }
});

export const endTurn = mutation({
  args: { ...matchArgs, expectedTurnId: v.union(v.id("turns"), v.null()), expiredOnly: v.boolean() },
  handler: async (ctx, args) => {
    await requirePlayer(ctx, args.gameId, args.sessionToken);
    const snapshot = await loadSnapshotForGame(ctx, args.gameId);
    if (snapshot.game.phase !== "playing" || !snapshot.activeTurn || snapshot.activeTurn.id !== args.expectedTurnId || (snapshot.game.match_number ?? 1) !== args.expectedMatchNumber) return true;
    if (args.expiredOnly && !turnExpired(snapshot)) return false;
    if (!turnExpired(snapshot)) await requireController(ctx, args.gameId, args.sessionToken);
    await endTurnForSnapshot(ctx, snapshot);
    return true;
  }
});

async function endTurnForSnapshot(ctx: MutationCtx, snapshot: FullGameSnapshot) {
    if (!snapshot.activeTurn) return;
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
    const nextPrompt = getPromptForPlayerTurn(reusablePrompts, nextAssignment?.player.id, activePromptId);

    if (!nextAssignment || !nextPrompt) {
      await ctx.db.patch(snapshot.game.id as Id<"games">, {
        phase: "finished",
        current_prompt_id: null,
        active_player_id: null,
        current_team_id: null,
        paused_at: null
      });
      return;
    }

    await ctx.db.patch(nextPrompt.id as Id<"prompts">, { status: "active" });
    await ctx.db.patch(snapshot.game.id as Id<"games">, {
      phase: "ready",
      active_player_id: nextAssignment.player.id as Id<"players">,
      current_team_id: nextAssignment.team.id as Id<"teams">,
      current_prompt_id: nextPrompt.id as Id<"prompts">,
      turn_number: snapshot.game.turn_number + 1,
      paused_at: null
    });

}

function turnExpired(snapshot: GameSnapshot) {
  return !snapshot.activeTurn || Date.now() >= Date.parse(snapshot.activeTurn.started_at) + snapshot.game.turn_duration_seconds * 1_000;
}

function requirePhase(phase: string, allowed: string[]) {
  if (!allowed.includes(phase)) throw new Error("This action is no longer available. Refresh to see the current game.");
}

async function matchesMatch(ctx: QueryOrMutationCtx, id: Id<"games">, expected: number) {
  return ((await requireGame(ctx, id)).match_number ?? 1) === expected;
}

async function requireGame(ctx: QueryOrMutationCtx, id: Id<"games">) {
  const game = await ctx.db.get(id);
  if (!game) throw new Error("Game not found.");
  return game;
}

async function loadSnapshotForGame(ctx: QueryOrMutationCtx, id: Id<"games">): Promise<FullGameSnapshot> {
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
  if (unusedCards.length < cardsNeeded) throw new Error("Not enough unique cards for another hand. Ask the host to add categories or reduce the hand size.");
  const game = await requireGame(ctx, game_id);
  const previousTitles = new Set(game.previous_card_titles ?? []);
  const freshCards = unusedCards.filter((card) => !previousTitles.has(card.title));
  const repeatCards = unusedCards.filter((card) => previousTitles.has(card.title));
  const hand = [...shuffle(freshCards), ...shuffle(repeatCards)].slice(0, cardsNeeded);
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
  if (snapshot.game.play_mode === "pass_and_play") return snapshot.prompts;
  await deleteByGame(ctx, "prompts", snapshot.game.id as Id<"games">);
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
            started_at: snapshot.activeTurn.started_at,
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

async function restoreGameEventState(ctx: MutationCtx, gameId: Id<"games">, event: Pick<GameEvent, "payload">) {
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
  await ctx.db.patch(gameId, {
    phase: event.payload.game.phase,
    current_team_id: event.payload.game.current_team_id as Id<"teams"> | null,
    active_player_id: event.payload.game.active_player_id as Id<"players"> | null,
    current_prompt_id: event.payload.game.current_prompt_id as Id<"prompts"> | null,
    turn_number: event.payload.game.turn_number,
    round_number: event.payload.game.round_number,
    paused_at: event.payload.game.paused_at
  });
}

async function restorePausedTurnTime(ctx: MutationCtx, gameId: Id<"games">, turnId: Id<"turns">, turnDurationSeconds: number) {
  const now = Date.now();
  const secondsToRestore = Math.min(15, turnDurationSeconds);
  const startedAt = new Date(now - Math.max(0, turnDurationSeconds - secondsToRestore) * 1_000).toISOString();
  await ctx.db.patch(turnId, { ended_at: null, started_at: startedAt });
  await ctx.db.patch(gameId, { phase: "paused", paused_at: new Date(now).toISOString() });
}

function snapshotMatchesActionState(
  snapshot: GameSnapshot,
  args: {
    expectedTurnId: Id<"turns"> | null;
    expectedMatchNumber: number;
    expectedPromptId: Id<"prompts"> | null;
    expectedTeamId: Id<"teams"> | null;
    expectedActivePlayerId: Id<"players"> | null;
    expectedTurnNumber: number;
  }
) {
  return (
    snapshot.game.phase === "playing" &&
    snapshot.activeTurn?.id === args.expectedTurnId &&
    (snapshot.game.match_number ?? 1) === args.expectedMatchNumber &&
    snapshot.game.current_prompt_id === args.expectedPromptId &&
    snapshot.game.current_team_id === args.expectedTeamId &&
    snapshot.game.active_player_id === args.expectedActivePlayerId &&
    snapshot.game.turn_number === args.expectedTurnNumber
  );
}

async function activateNextPrompt(ctx: MutationCtx, game_id: Id<"games">, excludePromptId?: Id<"prompts"> | null, avoidPlayerId?: string | null) {
  const promptList = (await promptsByGame(ctx, game_id))
    .filter((prompt) => prompt.status === "available")
    .sort((a, b) => (a.deck_order ?? 9999) - (b.deck_order ?? 9999));
  const nextPrompt = getPromptForPlayerTurn(promptList.map(toPrompt), avoidPlayerId, excludePromptId);
  if (!nextPrompt) return null;
  await ctx.db.patch(nextPrompt.id as Id<"prompts">, { status: "active" });
  await ctx.db.patch(game_id, { current_prompt_id: nextPrompt.id as Id<"prompts"> });
  return nextPrompt;
}

async function prepareNextRound(ctx: MutationCtx, snapshot: GameSnapshot) {
  if (snapshot.activeTurn) {
    await ctx.db.patch(snapshot.activeTurn.id as Id<"turns">, { ended_at: nowIso() });
  }
  const id = snapshot.game.id as Id<"games">;
  if (isFinalRound(snapshot.game.round_number)) {
    await ctx.db.patch(id, {
      finish_reason: "completed",
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
  const nextAssignment = getNextTurnAssignment(snapshot);
  const firstPrompt = nextAssignment ? getPromptForPlayerTurn(shuffledPrompts, nextAssignment.player.id) : null;
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
      status: prompt.id === firstPrompt.id ? "active" : "available"
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
  if (!Number.isFinite(value)) throw new Error("Choose a valid number.");
  return Math.min(max, Math.max(min, Math.round(value)));
}

function toGame(doc: Doc<"games">) {
  const { previous_card_titles, ...game } = stripDoc(doc);
  void previous_card_titles;
  return { ...game, id: doc._id };
}

function toPlayer(doc: Doc<"players">) {
  return { id: doc._id, game_id: doc.game_id, name: doc.name, is_host: doc.is_host, team_id: doc.team_id, has_submitted: doc.has_submitted, created_at: doc.created_at };
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
