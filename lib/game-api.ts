"use client";

import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
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
  return getConvexClient().mutation(api.game.createGame, { hostName });
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
    gameId: gameId as Id<"games">,
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
  return getConvexClient().mutation(api.game.joinGame, { code, playerName });
}

export async function loadSnapshot(gameId: string) {
  return getConvexClient().query(api.game.loadSnapshot, { gameId: gameId as Id<"games"> });
}

export async function updatePlayerName(playerId: string, name: string) {
  await getConvexClient().mutation(api.game.updatePlayerName, { playerId: playerId as Id<"players">, name });
}

export async function assignPlayerToTeam(playerId: string, teamId: string) {
  await getConvexClient().mutation(api.game.assignPlayerToTeam, {
    playerId: playerId as Id<"players">,
    teamId: teamId as Id<"teams">
  });
}

export async function submitPrompts(gameId: string, playerId: string, prompts: Array<string | { text: string; category?: string }>) {
  await getConvexClient().mutation(api.game.submitPrompts, {
    gameId: gameId as Id<"games">,
    playerId: playerId as Id<"players">,
    prompts
  });
}

export async function setDraftCardSelected(snapshot: GameSnapshot, playerId: string, draftCardId: string, selected: boolean) {
  await getConvexClient().mutation(api.game.setDraftCardSelected, {
    gameId: snapshot.game.id as Id<"games">,
    playerId: playerId as Id<"players">,
    draftCardId: draftCardId as Id<"draft_cards">,
    selected
  });
}

export async function startGame(snapshot: GameSnapshot) {
  await getConvexClient().mutation(api.game.startGame, { gameId: snapshot.game.id as Id<"games"> });
}

export async function startTurn(snapshot: GameSnapshot) {
  await getConvexClient().mutation(api.game.startTurn, { gameId: snapshot.game.id as Id<"games"> });
}

export async function pauseGame(snapshot: GameSnapshot) {
  await getConvexClient().mutation(api.game.pauseGame, { gameId: snapshot.game.id as Id<"games"> });
}

export async function resumeGame(snapshot: GameSnapshot) {
  await getConvexClient().mutation(api.game.resumeGame, { gameId: snapshot.game.id as Id<"games"> });
}

export async function finishGame(snapshot: GameSnapshot) {
  await getConvexClient().mutation(api.game.finishGame, { gameId: snapshot.game.id as Id<"games"> });
}

export async function resetToLobby(snapshot: GameSnapshot) {
  await getConvexClient().mutation(api.game.resetToLobby, { gameId: snapshot.game.id as Id<"games"> });
}

export async function adjustTeamScore(snapshot: GameSnapshot, teamId: string, delta: number) {
  await getConvexClient().mutation(api.game.adjustTeamScore, {
    gameId: snapshot.game.id as Id<"games">,
    teamId: teamId as Id<"teams">,
    delta
  });
}

export async function undoLastAction(snapshot: GameSnapshot) {
  await getConvexClient().mutation(api.game.undoLastAction, { gameId: snapshot.game.id as Id<"games"> });
}

export async function markCorrect(snapshot: GameSnapshot) {
  await getConvexClient().mutation(api.game.markCorrect, {
    gameId: snapshot.game.id as Id<"games">,
    expectedPromptId: snapshot.game.current_prompt_id as Id<"prompts"> | null,
    expectedTeamId: snapshot.game.current_team_id as Id<"teams"> | null,
    expectedActivePlayerId: snapshot.game.active_player_id as Id<"players"> | null,
    expectedTurnNumber: snapshot.game.turn_number
  });
}

export async function skipPrompt(snapshot: GameSnapshot) {
  await getConvexClient().mutation(api.game.skipPrompt, {
    gameId: snapshot.game.id as Id<"games">,
    expectedPromptId: snapshot.game.current_prompt_id as Id<"prompts"> | null,
    expectedTeamId: snapshot.game.current_team_id as Id<"teams"> | null,
    expectedActivePlayerId: snapshot.game.active_player_id as Id<"players"> | null,
    expectedTurnNumber: snapshot.game.turn_number
  });
}

export async function endTurn(snapshot: GameSnapshot) {
  await getConvexClient().mutation(api.game.endTurn, { gameId: snapshot.game.id as Id<"games"> });
}
