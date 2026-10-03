"use client";

import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { getSessionToken, pendingSession, saveSession } from "./player-session";
import { getConvexClient } from "./convex-client";
import { getDefaultPassPlayCardCount, MIXED_PASS_PLAY_CATEGORY } from "./pass-play-deck";
import type { GameSnapshot, PlayMode, PromptMode } from "./types";
import {
  DEFAULT_CARDS_DEALT_PER_PLAYER,
  DEFAULT_CARDS_KEPT_PER_PLAYER,
  DEFAULT_PLAY_MODE,
  DEFAULT_TEAM_ASSIGNMENT_MODE,
  TURN_DURATION_SECONDS
} from "./game-utils";

export async function createGame(hostName: string) {
  const sessionToken = pendingSession("create");
  const result = await getConvexClient().mutation(api.game.createGame, { hostName, sessionToken });
  saveSession(result.game.id, result.game.code, result.player.id, sessionToken);
  localStorage.removeItem("fish-bowl:pending:create");
  return result;
}

export async function saveGameSetup(
  gameId: string,
  promptsPerPlayer: number,
  teamNames: string[],
  teamAssignmentMode: "auto" | "choose" = DEFAULT_TEAM_ASSIGNMENT_MODE,
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
  return getConvexClient().mutation(api.game.saveGameSetup, {
    ...roomArgs(gameId),
    promptsPerPlayer,
    teamNames,
    teamAssignmentMode,
    promptMode,
    expectedPlayers: expectedPlayers ?? null,
    cardsDealtPerPlayer,
    cardsKeptPerPlayer,
    turnDurationSeconds,
    playMode,
    passAndPlayPlayers,
    passPlayCardCount,
    passPlayCategories,
    promptCategories
  });
}

export async function joinGame(code: string, playerName: string) {
  code = code.trim().toUpperCase();
  const knownGame = localStorage.getItem(`fish-bowl:code:${code}`);
  const sessionToken = (knownGame && getSessionToken(knownGame)) || pendingSession(`join:${code}`);
  const result = await getConvexClient().mutation(api.game.joinGame, { code, playerName, sessionToken });
  saveSession(result.game.id, result.game.code, result.player.id, sessionToken);
  localStorage.removeItem(`fish-bowl:pending:join:${code}`);
  return result;
}

export async function loadSnapshot(gameId: string, sessionToken = getSessionToken(gameId)) {
  const snapshot = await getConvexClient().query(api.game.loadSnapshot, { gameId: gameId as Id<"games">, sessionToken });
  if (!snapshot) throw new Error("This room is no longer available. Create a new game from Home.");
  return snapshot;
}

export async function updatePlayerName(gameId: string, playerId: string, name: string) {
  await getConvexClient().mutation(api.game.updatePlayerName, { ...roomArgs(gameId), playerId: playerId as Id<"players">, name });
}

export async function assignPlayerToTeam(gameId: string, playerId: string, teamId: string) {
  await getConvexClient().mutation(api.game.assignPlayerToTeam, {
    ...roomArgs(gameId),
    playerId: playerId as Id<"players">,
    teamId: teamId as Id<"teams">
  });
}

export async function submitPrompts(gameId: string, playerId: string, prompts: Array<string | { text: string; category?: string }>) {
  await getConvexClient().mutation(api.game.submitPrompts, {
    ...roomArgs(gameId),
    playerId: playerId as Id<"players">,
    prompts
  });
}

export async function setDraftCardSelected(snapshot: GameSnapshot, playerId: string, draftCardId: string, selected: boolean) {
  await getConvexClient().mutation(api.game.setDraftCardSelected, {
    ...roomArgs(snapshot.game.id),
    playerId: playerId as Id<"players">,
    draftCardId: draftCardId as Id<"draft_cards">,
    selected
  });
}

export async function startGame(snapshot: GameSnapshot) {
  await getConvexClient().mutation(api.game.startGame, { ...matchArgs(snapshot) });
}

export async function startTurn(snapshot: GameSnapshot) {
  await getConvexClient().mutation(api.game.startTurn, { ...matchArgs(snapshot), expectedTurnNumber: snapshot.game.turn_number });
}

export async function pauseGame(snapshot: GameSnapshot) {
  await getConvexClient().mutation(api.game.pauseGame, { ...matchArgs(snapshot) });
}

export async function resumeGame(snapshot: GameSnapshot) {
  await getConvexClient().mutation(api.game.resumeGame, { ...matchArgs(snapshot) });
}

export async function finishGame(snapshot: GameSnapshot) {
  await getConvexClient().mutation(api.game.finishGame, { ...matchArgs(snapshot) });
}

export async function resetToLobby(snapshot: GameSnapshot, freshCards = false) {
  await getConvexClient().mutation(api.game.resetToLobby, { ...matchArgs(snapshot), freshCards });
}

export async function adjustTeamScore(snapshot: GameSnapshot, teamId: string, delta: number) {
  await getConvexClient().mutation(api.game.adjustTeamScore, {
    ...matchArgs(snapshot),
    teamId: teamId as Id<"teams">,
    delta
  });
}

export async function redoLastFivePrompts(snapshot: GameSnapshot) {
  await getConvexClient().mutation(api.game.redoLastFivePrompts, { ...matchArgs(snapshot) });
}

export async function undoLastAction(snapshot: GameSnapshot) {
  await getConvexClient().mutation(api.game.undoLastAction, { ...matchArgs(snapshot) });
}

export async function markCorrect(snapshot: GameSnapshot) {
  await getConvexClient().mutation(api.game.markCorrect, {
    ...matchArgs(snapshot),
    expectedTurnId: snapshot.activeTurn?.id as Id<"turns"> | null ?? null,
    expectedPromptId: snapshot.game.current_prompt_id as Id<"prompts"> | null,
    expectedTeamId: snapshot.game.current_team_id as Id<"teams"> | null,
    expectedActivePlayerId: snapshot.game.active_player_id as Id<"players"> | null,
    expectedTurnNumber: snapshot.game.turn_number
  });
}

export async function skipPrompt(snapshot: GameSnapshot) {
  await getConvexClient().mutation(api.game.skipPrompt, {
    ...matchArgs(snapshot),
    expectedTurnId: snapshot.activeTurn?.id as Id<"turns"> | null ?? null,
    expectedPromptId: snapshot.game.current_prompt_id as Id<"prompts"> | null,
    expectedTeamId: snapshot.game.current_team_id as Id<"teams"> | null,
    expectedActivePlayerId: snapshot.game.active_player_id as Id<"players"> | null,
    expectedTurnNumber: snapshot.game.turn_number
  });
}

export async function endTurn(snapshot: GameSnapshot, expiredOnly = false) {
  return getConvexClient().mutation(api.game.endTurn, { ...matchArgs(snapshot), expiredOnly, expectedTurnId: snapshot.activeTurn?.id as Id<"turns"> | null ?? null });
}

function roomArgs(gameId: string) {
  return { gameId: gameId as Id<"games">, sessionToken: getSessionToken(gameId) };
}

function matchArgs(snapshot: GameSnapshot) {
  return { ...roomArgs(snapshot.game.id), expectedMatchNumber: snapshot.game.match_number ?? 1 };
}

export async function synchronizeClock(gameId: string) {
  return getConvexClient().mutation(api.game.synchronizeClock, roomArgs(gameId));
}
