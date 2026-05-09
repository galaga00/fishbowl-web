"use client";

import { hasSupabaseConfig, supabase } from "./supabase";
import { buildPassPlayDeck, filterStarterDeckByCategories, getDefaultPassPlayCardCount, MIXED_PASS_PLAY_CATEGORY } from "./pass-play-deck";
import { isStarterDeckCardAllowed } from "./starter-deck";
import type { DraftCard, Game, GameEvent, GameSnapshot, Player, PlayMode, Prompt, PromptMode, Team, Turn } from "./types";
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
} from "./game-utils";

function ensureSupabaseConfig() {
  if (!hasSupabaseConfig) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY.");
  }
}

export async function createGame(hostName: string) {
  ensureSupabaseConfig();
  let game: Game | null = null;
  let lastError: unknown = null;

  for (let attempt = 0; attempt < 5 && !game; attempt += 1) {
    const { data, error } = await supabase
      .from("games")
      .insert({
        code: createJoinCode(),
        phase: "setup",
        prompts_per_player: DEFAULT_PROMPTS_PER_PLAYER,
        turn_duration_seconds: TURN_DURATION_SECONDS,
        cards_dealt_per_player: DEFAULT_CARDS_DEALT_PER_PLAYER,
        cards_kept_per_player: DEFAULT_CARDS_KEPT_PER_PLAYER,
        pass_play_card_count: getDefaultPassPlayCardCount(4),
        team_assignment_mode: DEFAULT_TEAM_ASSIGNMENT_MODE,
        prompt_mode: "free",
        prompt_categories: [MIXED_PASS_PLAY_CATEGORY],
        play_mode: DEFAULT_PLAY_MODE,
        paused_at: null
      })
      .select("*")
      .single<Game>();

    if (error) {
      lastError = error;
    } else {
      game = data;
    }
  }

  if (!game) throw lastError ?? new Error("Could not create game.");

  const { data: host, error: hostError } = await supabase
    .from("players")
    .insert({
      game_id: game.id,
      name: hostName.trim() || "Host",
      is_host: true
    })
    .select("*")
    .single<Player>();

  if (hostError) throw hostError;

  const { data: updatedGame, error: updateError } = await supabase
    .from("games")
    .update({ host_player_id: host.id })
    .eq("id", game.id)
    .select("*")
    .single<Game>();

  if (updateError) throw updateError;
  return { game: updatedGame, player: host };
}

export async function saveGameSetup(
  gameId: string,
  promptsPerPlayer: number,
  teamNames: string[],
  teamAssignmentMode: "auto" | "choose",
  promptMode: PromptMode,
  expectedPlayers?: number | null,
  cardsDealtPerPlayer = DEFAULT_CARDS_DEALT_PER_PLAYER,
  cardsKeptPerPlayer = DEFAULT_CARDS_KEPT_PER_PLAYER,
  turnDurationSeconds = TURN_DURATION_SECONDS,
  playMode: PlayMode = DEFAULT_PLAY_MODE,
  passAndPlayPlayers: Array<{ name: string; teamIndex: number }> = [],
  passPlayCardCount = getDefaultPassPlayCardCount(passAndPlayPlayers.length || 4),
  passPlayCategories: string[] = [MIXED_PASS_PLAY_CATEGORY],
  promptCategories: string[] = [MIXED_PASS_PLAY_CATEGORY]
) {
  ensureSupabaseConfig();
  const cleanPromptsPerPlayer = Math.min(20, Math.max(1, Math.round(promptsPerPlayer)));
  const cleanCardsDealtPerPlayer = Math.min(20, Math.max(1, Math.round(cardsDealtPerPlayer)));
  const cleanCardsKeptPerPlayer = Math.min(
    cleanCardsDealtPerPlayer,
    Math.max(1, Math.round(cardsKeptPerPlayer))
  );
  const cleanTeamNames = teamNames.map((name, index) => name.trim() || `Team ${index + 1}`).slice(0, 12);
  const cleanPlayMode: PlayMode = playMode === "pass_and_play" ? "pass_and_play" : DEFAULT_PLAY_MODE;
  const cleanPromptMode: PromptMode = promptMode;
  const cleanPassAndPlayPlayers = passAndPlayPlayers
    .map((player, index) => ({
      name: player.name.trim() || `Player ${index + 1}`,
      teamIndex: Math.max(0, Math.round(player.teamIndex || 0))
    }))
    .slice(0, 40);
  const cleanPassPlayCardCount = Math.min(80, Math.max(10, Math.round(passPlayCardCount)));
  const cleanPromptCategories = promptCategories.length > 0 ? promptCategories : [MIXED_PASS_PLAY_CATEGORY];
  const cleanExpectedPlayers = expectedPlayers ? Math.min(200, Math.max(1, Math.round(expectedPlayers))) : null;
  const cleanTurnDurationSeconds = TURN_DURATION_OPTIONS.includes(turnDurationSeconds as (typeof TURN_DURATION_OPTIONS)[number])
    ? turnDurationSeconds
    : TURN_DURATION_SECONDS;

  if (cleanTeamNames.length < 1) throw new Error("Add at least one team.");

  const { error: promptDeleteError } = await supabase.from("prompts").delete().eq("game_id", gameId);
  if (promptDeleteError) throw promptDeleteError;

  const { error: draftDeleteError } = await supabase.from("draft_cards").delete().eq("game_id", gameId);
  if (draftDeleteError) throw draftDeleteError;

  const { error: deleteError } = await supabase.from("teams").delete().eq("game_id", gameId);
  if (deleteError) throw deleteError;

  const { data: teams, error: teamError } = await supabase
    .from("teams")
    .insert(cleanTeamNames.map((name, sort_order) => ({ game_id: gameId, name, sort_order })))
    .select("*")
    .order("sort_order");

  if (teamError) throw teamError;

  const firstTeam = (teams as Team[])[0];
  const { error: gameError } = await supabase
    .from("games")
    .update({
      prompts_per_player: cleanPromptsPerPlayer,
      turn_duration_seconds: cleanTurnDurationSeconds,
      cards_dealt_per_player: cleanCardsDealtPerPlayer,
      cards_kept_per_player: cleanCardsKeptPerPlayer,
      pass_play_card_count: cleanPassPlayCardCount,
      expected_players: cleanPlayMode === "pass_and_play" ? Math.max(cleanPassAndPlayPlayers.length, 1) : cleanExpectedPlayers,
      team_assignment_mode: cleanPlayMode === "pass_and_play" ? "auto" : teamAssignmentMode,
      prompt_mode: cleanPromptMode,
      prompt_categories: cleanPlayMode === "pass_and_play" ? passPlayCategories : cleanPromptCategories,
      play_mode: cleanPlayMode,
      phase: "lobby"
    })
    .eq("id", gameId);

  if (gameError) throw gameError;

  if (cleanPlayMode === "pass_and_play") {
    const { data: host, error: hostError } = await supabase
      .from("players")
      .select("*")
      .eq("game_id", gameId)
      .eq("is_host", true)
      .single<Player>();
    if (hostError) throw hostError;

    const players = cleanPassAndPlayPlayers.length > 0 ? cleanPassAndPlayPlayers : [{ name: host.name || "Player 1", teamIndex: 0 }];
    const hostPlayer = players[0] ?? { name: host.name, teamIndex: 0 };
    const hostTeam = (teams as Team[])[0];
    const { error: updateHostError } = await supabase
      .from("players")
      .update({
        name: hostPlayer.name,
        team_id: (teams as Team[])[hostPlayer.teamIndex % Math.max((teams as Team[]).length, 1)]?.id ?? hostTeam.id,
        has_submitted: cleanPromptMode === "deck"
      })
      .eq("id", host.id);
    if (updateHostError) throw updateHostError;

    const { error: nonHostDeleteError } = await supabase.from("players").delete().eq("game_id", gameId).eq("is_host", false);
    if (nonHostDeleteError) throw nonHostDeleteError;

    const extraPlayers = players.slice(1);
    if (extraPlayers.length > 0) {
      const { error: playerError } = await supabase.from("players").insert(
        extraPlayers.map((player) => ({
          game_id: gameId,
          name: player.name,
          team_id: (teams as Team[])[player.teamIndex % Math.max((teams as Team[]).length, 1)]?.id ?? firstTeam.id,
          has_submitted: cleanPromptMode === "deck"
        }))
      );
      if (playerError) throw playerError;
    }

    if (cleanPromptMode === "deck") {
      const promptDeck = buildPassPlayDeck(cleanPassPlayCardCount, passPlayCategories);
      const { error: promptError } = await supabase.from("prompts").insert(
        promptDeck.map((card) => ({
          game_id: gameId,
          player_id: host.id,
          text: card.title,
          description: card.description,
          category: card.category
        }))
      );
      if (promptError) throw promptError;
    }
  } else {
    const { error: hostError } = await supabase.from("players").update({ team_id: firstTeam.id }).eq("game_id", gameId).eq("is_host", true);
    if (hostError) throw hostError;
  }

  if (cleanPlayMode !== "pass_and_play" && cleanPromptMode === "deck") {
    const { data: players, error: playersError } = await supabase.from("players").select("*").eq("game_id", gameId);
    if (playersError) throw playersError;
    await Promise.all((players as Player[]).map((player) => ensureDraftHand(gameId, player.id, cleanCardsDealtPerPlayer, cleanPromptCategories)));
  }
}

export async function joinGame(code: string, playerName: string) {
  ensureSupabaseConfig();
  const { data: game, error: gameError } = await supabase
    .from("games")
    .select("*")
    .eq("code", code)
    .single<Game>();

  if (gameError) throw new Error("No game found for that code.");
  if (game.phase === "setup") throw new Error("The host is still setting up this game.");
  if (game.play_mode === "pass_and_play") throw new Error("This game is in Pass & Play mode. Use the host phone.");

  const { data: teams, error: teamError } = await supabase
    .from("teams")
    .select("*")
    .eq("game_id", game.id)
    .order("sort_order");

  if (teamError) throw teamError;

  const { count, error: countError } = await supabase
    .from("players")
    .select("id", { count: "exact", head: true })
    .eq("game_id", game.id);

  if (countError) throw countError;

  const team = teams?.[(count ?? 0) % Math.max(teams.length, 1)] as Team | undefined;
  const { data: player, error: playerError } = await supabase
    .from("players")
    .insert({
      game_id: game.id,
      name: playerName.trim() || `Player ${(count ?? 0) + 1}`,
      team_id: game.team_assignment_mode === "auto" ? (team?.id ?? null) : null
    })
    .select("*")
    .single<Player>();

  if (playerError) throw playerError;

  if (game.prompt_mode === "deck") {
    await ensureDraftHand(game.id, player.id, game.cards_dealt_per_player, game.prompt_categories ?? [MIXED_PASS_PLAY_CATEGORY]);
  }

  return { game, player };
}

export async function loadSnapshot(gameId: string) {
  ensureSupabaseConfig();
  const [gameResult, playersResult, teamsResult, promptsResult, draftCardsResult, turnResult, eventResult] = await Promise.all([
    supabase.from("games").select("*").eq("id", gameId).single<Game>(),
    supabase.from("players").select("*").eq("game_id", gameId).order("created_at"),
    supabase.from("teams").select("*").eq("game_id", gameId).order("sort_order"),
    supabase.from("prompts").select("*").eq("game_id", gameId).order("deck_order", { nullsFirst: false }),
    supabase.from("draft_cards").select("*").eq("game_id", gameId).order("sort_order"),
    supabase
      .from("turns")
      .select("*")
      .eq("game_id", gameId)
      .is("ended_at", null)
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle<Turn>(),
    supabase
      .from("game_events")
      .select("*")
      .eq("game_id", gameId)
      .is("undone_at", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle<GameEvent>()
  ]);

  if (gameResult.error) throw gameResult.error;
  if (playersResult.error) throw playersResult.error;
  if (teamsResult.error) throw teamsResult.error;
  if (promptsResult.error) throw promptsResult.error;
  if (draftCardsResult.error) throw draftCardsResult.error;
  if (turnResult.error) throw turnResult.error;
  if (eventResult.error) throw eventResult.error;

  return {
    game: gameResult.data,
    players: playersResult.data as Player[],
    teams: teamsResult.data as Team[],
    prompts: promptsResult.data as Prompt[],
    draftCards: (draftCardsResult.data as DraftCard[]).filter((card) => isStarterDeckCardAllowed(card.card_id)),
    activeTurn: turnResult.data,
    latestUndoableEvent: eventResult.data
  } satisfies GameSnapshot;
}

export async function updatePlayerName(playerId: string, name: string) {
  ensureSupabaseConfig();
  const { error } = await supabase.from("players").update({ name: name.trim() || "Player" }).eq("id", playerId);
  if (error) throw error;
}

export async function assignPlayerToTeam(playerId: string, teamId: string) {
  ensureSupabaseConfig();
  const { error } = await supabase.from("players").update({ team_id: teamId }).eq("id", playerId);
  if (error) throw error;
}

export async function submitPrompts(gameId: string, playerId: string, prompts: Array<string | { text: string; category?: string }>) {
  ensureSupabaseConfig();
  const cleanPrompts = prompts
    .map((prompt) => {
      if (typeof prompt === "string") return { text: prompt.trim(), category: null };
      return { text: prompt.text.trim(), category: prompt.category?.trim() || null };
    })
    .filter((prompt) => prompt.text);
  const { data: game, error: gameError } = await supabase.from("games").select("*").eq("id", gameId).single<Game>();
  if (gameError) throw gameError;

  let countQuery = supabase.from("prompts").select("id", { count: "exact", head: true }).eq("game_id", gameId);
  if (game.play_mode !== "pass_and_play") {
    countQuery = countQuery.eq("player_id", playerId);
  }
  const { count, error: countError } = await countQuery;

  if (countError) throw countError;

  const { count: playerCount, error: playerCountError } = await supabase
    .from("players")
    .select("id", { count: "exact", head: true })
    .eq("game_id", gameId);
  if (playerCountError) throw playerCountError;

  const requiredCount = game.play_mode === "pass_and_play" ? game.prompts_per_player * Math.max(playerCount ?? 1, 1) : game.prompts_per_player;
  const slotsLeft = Math.max(0, requiredCount - (count ?? 0));
  const promptsToInsert = cleanPrompts.slice(0, slotsLeft);

  if (promptsToInsert.length > 0) {
    const { error: promptError } = await supabase.from("prompts").insert(
      promptsToInsert.map((text) => ({
        game_id: gameId,
        player_id: playerId,
        text: text.text,
        category: text.category
      }))
    );
    if (promptError) throw promptError;
  }

  const nextPromptCount = (count ?? 0) + promptsToInsert.length;
  let playerUpdate = supabase.from("players").update({ has_submitted: nextPromptCount >= requiredCount });
  playerUpdate = game.play_mode === "pass_and_play" ? playerUpdate.eq("game_id", gameId) : playerUpdate.eq("id", playerId);
  const { error: playerError } = await playerUpdate;
  if (playerError) throw playerError;
}

export async function setDraftCardSelected(snapshot: GameSnapshot, playerId: string, draftCardId: string, selected: boolean) {
  ensureSupabaseConfig();
  if (snapshot.game.prompt_mode !== "deck") return;

  const currentSelectedCount = snapshot.draftCards.filter((card) => card.player_id === playerId && card.selected).length;
  const card = snapshot.draftCards.find((candidate) => candidate.id === draftCardId && candidate.player_id === playerId);
  if (!card) throw new Error("That card is not in your hand.");
  if (selected && !card.selected && currentSelectedCount >= snapshot.game.cards_kept_per_player) {
    throw new Error(`Choose only ${snapshot.game.cards_kept_per_player} cards.`);
  }

  const { error: cardError } = await supabase.from("draft_cards").update({ selected }).eq("id", draftCardId);
  if (cardError) throw cardError;

  const nextSelectedCount = currentSelectedCount + (selected && !card.selected ? 1 : 0) - (!selected && card.selected ? 1 : 0);
  const { error: playerError } = await supabase
    .from("players")
    .update({ has_submitted: nextSelectedCount >= snapshot.game.cards_kept_per_player })
    .eq("id", playerId);
  if (playerError) throw playerError;
}

export async function startGame(snapshot: GameSnapshot) {
  ensureSupabaseConfig();
  const unreadyPlayer = snapshot.players.find((player) => {
    if (!player.team_id) return true;
    if (snapshot.game.play_mode === "pass_and_play") return false;
    if (snapshot.game.prompt_mode === "deck") return !hasPlayerDrafted(player.id, snapshot);
    return !hasPlayerSubmitted(player.id, snapshot.prompts, snapshot.game.prompts_per_player);
  });

  if (unreadyPlayer) {
    throw new Error(
      `${unreadyPlayer.name} still needs a team and ${snapshot.game.prompt_mode === "deck" ? "cards" : "prompts"}.`
    );
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

  const promptPool = snapshot.game.prompt_mode === "deck" ? await ensureDeckDraftPrompts(snapshot) : snapshot.prompts;
  const shuffledPrompts = shuffle(promptPool);
  const firstAssignment = getFirstTurnAssignment(snapshot);
  const firstPrompt = shuffledPrompts[0];

  if (!firstAssignment || !firstPrompt) throw new Error("Need at least one player and one prompt to start.");

  const promptUpdates = shuffledPrompts.map((prompt, deckOrder) =>
    supabase.from("prompts").update({ deck_order: deckOrder, status: deckOrder === 0 ? "active" : "available" }).eq("id", prompt.id)
  );

  await Promise.all(promptUpdates);

  const { error: gameError } = await supabase
    .from("games")
    .update({
      phase: "ready",
      active_player_id: firstAssignment.player.id,
      current_team_id: firstAssignment.team.id,
      current_prompt_id: firstPrompt.id,
      turn_number: 1,
      round_number: 1,
      paused_at: null
    })
    .eq("id", snapshot.game.id);

  if (gameError) throw gameError;
}

async function ensureDraftHand(gameId: string, playerId: string, cardsToDeal: number, selectedCategories: string[]) {
  const { data: playerCards, error: playerCardsError } = await supabase
    .from("draft_cards")
    .select("id, card_id, sort_order")
    .eq("game_id", gameId)
    .eq("player_id", playerId);

  if (playerCardsError) throw playerCardsError;

  const existingPlayerCards = (playerCards ?? []) as Array<{ id: string; card_id: string; sort_order: number }>;
  const invalidPlayerCards = existingPlayerCards.filter((card) => !isStarterDeckCardAllowed(card.card_id));
  if (invalidPlayerCards.length > 0) {
    const { error: deleteInvalidError } = await supabase
      .from("draft_cards")
      .delete()
      .in(
        "id",
        invalidPlayerCards.map((card) => card.id)
      );
    if (deleteInvalidError) throw deleteInvalidError;
  }

  const validPlayerCards = existingPlayerCards.filter((card) => isStarterDeckCardAllowed(card.card_id));
  if (validPlayerCards.length >= cardsToDeal) return;

  const { data: existingCards, error: existingError } = await supabase
    .from("draft_cards")
    .select("card_id")
    .eq("game_id", gameId);
  if (existingError) throw existingError;

  const usedIds = new Set((existingCards ?? []).map((card) => card.card_id as string));
  const categoryCards = filterStarterDeckByCategories(selectedCategories);
  const unusedCards = categoryCards.filter((card) => !usedIds.has(card.id));
  const cardsNeeded = cardsToDeal - validPlayerCards.length;
  const sourceCards = unusedCards.length >= cardsNeeded ? unusedCards : categoryCards;
  const hand = shuffle(sourceCards).slice(0, cardsNeeded);
  const nextSortOrder = validPlayerCards.reduce((max, card) => Math.max(max, card.sort_order), -1) + 1;

  const { error } = await supabase.from("draft_cards").insert(
    hand.map((card, sort_order) => ({
      game_id: gameId,
      player_id: playerId,
      card_id: card.id,
      title: card.title,
      description: card.description,
      sort_order: nextSortOrder + sort_order
    }))
  );
  if (error) throw error;
}

async function ensureDeckDraftPrompts(snapshot: GameSnapshot) {
  if (snapshot.prompts.length > 0) return snapshot.prompts;

  const selectedCards = snapshot.draftCards.filter((card) => card.selected);
  if (selectedCards.length === 0) throw new Error("Choose at least one card before starting.");

  const { data, error } = await supabase
    .from("prompts")
    .insert(
      selectedCards.map((card) => ({
        game_id: card.game_id,
        player_id: card.player_id,
        text: card.title,
        description: card.description,
        category: "Deck Draft"
      }))
    )
    .select("*");

  if (error) throw error;
  return data as Prompt[];
}

export async function startTurn(snapshot: GameSnapshot) {
  ensureSupabaseConfig();
  const activePlayer = snapshot.players.find((player) => player.id === snapshot.game.active_player_id);
  const team = snapshot.teams.find((candidate) => candidate.id === snapshot.game.current_team_id);

  if (!activePlayer || !team || !snapshot.game.current_prompt_id) {
    throw new Error("This turn is not ready to start yet.");
  }

  if (snapshot.activeTurn) {
    const { error } = await supabase.from("turns").update({ ended_at: new Date().toISOString() }).eq("id", snapshot.activeTurn.id);
    if (error) throw error;
  }

  const { error: turnError } = await supabase.from("turns").insert({
    game_id: snapshot.game.id,
    team_id: team.id,
    player_id: activePlayer.id
  });
  if (turnError) throw turnError;

  const { error: gameError } = await supabase.from("games").update({ phase: "playing", paused_at: null }).eq("id", snapshot.game.id);
  if (gameError) throw gameError;
}

export async function pauseGame(snapshot: GameSnapshot) {
  ensureSupabaseConfig();
  if (snapshot.game.phase !== "playing") return;
  const { error } = await supabase.from("games").update({ phase: "paused", paused_at: new Date().toISOString() }).eq("id", snapshot.game.id);
  if (error) throw error;
}

export async function resumeGame(snapshot: GameSnapshot) {
  ensureSupabaseConfig();
  if (snapshot.game.phase !== "paused") return;
  const pausedAt = snapshot.game.paused_at ? new Date(snapshot.game.paused_at).getTime() : Date.now();
  const pausedMilliseconds = Math.max(0, Date.now() - pausedAt);
  if (snapshot.activeTurn) {
    const adjustedStartedAt = new Date(new Date(snapshot.activeTurn.started_at).getTime() + pausedMilliseconds).toISOString();
    const { error: turnError } = await supabase.from("turns").update({ started_at: adjustedStartedAt }).eq("id", snapshot.activeTurn.id);
    if (turnError) throw turnError;
  }
  const { error } = await supabase.from("games").update({ phase: "playing", paused_at: null }).eq("id", snapshot.game.id);
  if (error) throw error;
}

export async function finishGame(snapshot: GameSnapshot) {
  ensureSupabaseConfig();
  const { error } = await supabase
    .from("games")
    .update({ phase: "finished", current_prompt_id: null, active_player_id: null, current_team_id: null, paused_at: null })
    .eq("id", snapshot.game.id);
  if (error) throw error;
}

export async function resetToLobby(snapshot: GameSnapshot) {
  ensureSupabaseConfig();
  const updates = [
    supabase.from("turns").update({ ended_at: new Date().toISOString() }).eq("game_id", snapshot.game.id).is("ended_at", null),
    supabase.from("prompts").update({ status: "available", deck_order: null }).eq("game_id", snapshot.game.id),
    supabase.from("teams").update({ score: 0 }).eq("game_id", snapshot.game.id),
    supabase
      .from("games")
      .update({
        phase: "lobby",
        current_prompt_id: null,
        active_player_id: null,
        current_team_id: null,
        paused_at: null,
        turn_number: 0,
        round_number: 1
      })
      .eq("id", snapshot.game.id)
  ];
  const results = await Promise.all(updates);
  const error = results.find((result) => result.error)?.error;
  if (error) throw error;
}

async function recordUndoPoint(snapshot: GameSnapshot, action: GameEvent["action"]) {
  const { error } = await supabase.from("game_events").insert({
    game_id: snapshot.game.id,
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
    }
  });
  if (error) throw error;
}

export async function undoLastAction(snapshot: GameSnapshot) {
  ensureSupabaseConfig();
  const event = snapshot.latestUndoableEvent;
  if (!event) throw new Error("Nothing to undo yet.");

  const teamUpdates = event.payload.teams.map((team) => supabase.from("teams").update({ score: team.score }).eq("id", team.id));
  const promptUpdates = event.payload.prompts.map((prompt) =>
    supabase.from("prompts").update({ status: prompt.status, deck_order: prompt.deck_order }).eq("id", prompt.id)
  );
  const turnUpdates = event.payload.activeTurn
    ? [
        supabase
          .from("turns")
          .update({
            ended_at: event.payload.activeTurn.ended_at,
            correct_count: event.payload.activeTurn.correct_count,
            skip_count: event.payload.activeTurn.skip_count
          })
          .eq("id", event.payload.activeTurn.id)
      ]
    : [];

  const results = await Promise.all([
    ...teamUpdates,
    ...promptUpdates,
    ...turnUpdates,
    supabase.from("games").update(event.payload.game).eq("id", snapshot.game.id),
    supabase.from("game_events").update({ undone_at: new Date().toISOString() }).eq("id", event.id)
  ]);
  const error = results.find((result) => result.error)?.error;
  if (error) throw error;
}

async function activateNextPrompt(gameId: string, excludePromptId?: string) {
  ensureSupabaseConfig();
  const { data: prompts, error } = await supabase
    .from("prompts")
    .select("*")
    .eq("game_id", gameId)
    .eq("status", "available")
    .order("deck_order", { nullsFirst: false });

  if (error) throw error;

  const promptList = prompts as Prompt[];
  const nextPrompt = promptList.find((prompt) => prompt.id !== excludePromptId) ?? promptList[0] ?? null;
  if (!nextPrompt) return null;

  const { error: promptError } = await supabase.from("prompts").update({ status: "active" }).eq("id", nextPrompt.id);
  if (promptError) throw promptError;

  const { error: gameError } = await supabase.from("games").update({ current_prompt_id: nextPrompt.id }).eq("id", gameId);
  if (gameError) throw gameError;
  return nextPrompt;
}

async function prepareNextRound(snapshot: GameSnapshot) {
  if (snapshot.activeTurn) {
    const { error } = await supabase
      .from("turns")
      .update({ ended_at: new Date().toISOString() })
      .eq("id", snapshot.activeTurn.id);
    if (error) throw error;
  }

  if (isFinalRound(snapshot.game.round_number)) {
    const { error } = await supabase
      .from("games")
      .update({ phase: "finished", current_prompt_id: null, active_player_id: null, current_team_id: null, paused_at: null })
      .eq("id", snapshot.game.id);
    if (error) throw error;
    return;
  }

  const nextRoundNumber = snapshot.game.round_number + 1;
  const shuffledPrompts = shuffle(snapshot.prompts);
  const firstPrompt = shuffledPrompts[0];
  const nextAssignment = getNextTurnAssignment(snapshot);

  if (!firstPrompt || !nextAssignment) {
    const { error } = await supabase
      .from("games")
      .update({ phase: "finished", current_prompt_id: null, active_player_id: null, current_team_id: null, paused_at: null })
      .eq("id", snapshot.game.id);
    if (error) throw error;
    return;
  }

  const promptUpdates = shuffledPrompts.map((prompt, deckOrder) =>
    supabase.from("prompts").update({ deck_order: deckOrder, status: deckOrder === 0 ? "active" : "available" }).eq("id", prompt.id)
  );

  const results = await Promise.all(promptUpdates);
  const promptError = results.find((result) => result.error)?.error;
  if (promptError) throw promptError;

  const { error: gameError } = await supabase
    .from("games")
    .update({
      phase: "ready",
      active_player_id: nextAssignment.player.id,
      current_team_id: nextAssignment.team.id,
      current_prompt_id: firstPrompt.id,
      round_number: nextRoundNumber,
      turn_number: snapshot.game.turn_number + 1,
      paused_at: null
    })
    .eq("id", snapshot.game.id);

  if (gameError) throw gameError;
}

export async function markCorrect(snapshot: GameSnapshot) {
  ensureSupabaseConfig();
  const promptId = snapshot.game.current_prompt_id;
  const teamId = snapshot.game.current_team_id;
  if (!promptId || !teamId) return;

  const team = snapshot.teams.find((candidate) => candidate.id === teamId);
  const turn = snapshot.activeTurn;
  const { data: updatedPrompts, error: promptError } = await supabase
    .from("prompts")
    .update({ status: "correct" })
    .eq("id", promptId)
    .eq("game_id", snapshot.game.id)
    .eq("status", "active")
    .select("id");

  if (promptError) throw promptError;
  if (!updatedPrompts || updatedPrompts.length === 0) return;

  await recordUndoPoint(snapshot, "correct");

  const updates = [
    supabase.from("teams").update({ score: (team?.score ?? 0) + 1 }).eq("id", teamId)
  ];

  if (turn) {
    updates.push(supabase.from("turns").update({ correct_count: turn.correct_count + 1 }).eq("id", turn.id));
  }

  const results = await Promise.all(updates);
  const error = results.find((result) => result.error)?.error;
  if (error) throw error;

  const nextPrompt = await activateNextPrompt(snapshot.game.id);
  if (!nextPrompt) {
    await prepareNextRound(snapshot);
  }
}

export async function skipPrompt(snapshot: GameSnapshot) {
  ensureSupabaseConfig();
  const promptId = snapshot.game.current_prompt_id;
  if (!promptId) return;
  await recordUndoPoint(snapshot, "skip");

  const maxDeckOrder = Math.max(0, ...snapshot.prompts.map((prompt) => prompt.deck_order ?? 0));
  const updates = [
    supabase.from("prompts").update({ status: "available", deck_order: maxDeckOrder + 1 }).eq("id", promptId)
  ];

  if (snapshot.activeTurn) {
    updates.push(supabase.from("turns").update({ skip_count: snapshot.activeTurn.skip_count + 1 }).eq("id", snapshot.activeTurn.id));
  }

  const results = await Promise.all(updates);
  const error = results.find((result) => result.error)?.error;
  if (error) throw error;
  await activateNextPrompt(snapshot.game.id, promptId);
}

export async function endTurn(snapshot: GameSnapshot) {
  ensureSupabaseConfig();
  await recordUndoPoint(snapshot, "end_turn");
  if (snapshot.activeTurn) {
    const { error } = await supabase
      .from("turns")
      .update({ ended_at: new Date().toISOString() })
      .eq("id", snapshot.activeTurn.id);
    if (error) throw error;
  }

  const activePromptId = snapshot.game.current_prompt_id;
  if (activePromptId) {
    await supabase.from("prompts").update({ status: "available" }).eq("id", activePromptId);
  }

  const nextAssignment = getNextTurnAssignment(snapshot);
  const reusablePrompts = snapshot.prompts
    .filter((prompt) => prompt.status === "available" || prompt.id === activePromptId)
    .sort((a, b) => (a.deck_order ?? 9999) - (b.deck_order ?? 9999));
  const nextPrompt = reusablePrompts.find((prompt) => prompt.id !== activePromptId) ?? reusablePrompts[0] ?? null;

  if (!nextAssignment || !nextPrompt) {
    const { error } = await supabase
      .from("games")
      .update({ phase: "finished", current_prompt_id: null, active_player_id: null, current_team_id: null, paused_at: null })
      .eq("id", snapshot.game.id);
    if (error) throw error;
    return;
  }

  const { error: promptError } = await supabase.from("prompts").update({ status: "active" }).eq("id", nextPrompt.id);
  if (promptError) throw promptError;

  const { error: gameError } = await supabase
    .from("games")
    .update({
      phase: "ready",
      active_player_id: nextAssignment.player.id,
      current_team_id: nextAssignment.team.id,
      current_prompt_id: nextPrompt.id,
      turn_number: snapshot.game.turn_number + 1,
      paused_at: null
    })
    .eq("id", snapshot.game.id);

  if (gameError) throw gameError;
}
