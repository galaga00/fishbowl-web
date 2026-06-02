import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import type { GameSnapshot } from "../../../lib/types";
import { createE2EConvexClient, getE2ESecret } from "./supabase-cleanup";

export type SeededTurnGame = {
  gameId: string;
  hostPlayerId: string;
  playerIdsByName: Record<string, string>;
};

type SeedReadyPassAndPlayOptions = {
  promptCount?: number;
  teamPlayers?: string[][];
  turnDurationSeconds?: 30 | 60;
};

const defaultTeamPlayers = [
  ["Austin", "Briar"],
  ["Casey", "Drew"]
];

export async function seedReadyPassAndPlayGame({
  promptCount = 10,
  teamPlayers = defaultTeamPlayers,
  turnDurationSeconds = 60
}: SeedReadyPassAndPlayOptions = {}): Promise<SeededTurnGame> {
  return createE2EConvexClient().mutation(api.e2e.seedReadyPassAndPlayGame, {
    secret: getE2ESecret(),
    promptCount,
    teamPlayers,
    turnDurationSeconds
  });
}

export async function seedPlayingPassAndPlayGame(options: SeedReadyPassAndPlayOptions = {}): Promise<SeededTurnGame> {
  const { promptCount = 10, teamPlayers = defaultTeamPlayers, turnDurationSeconds = 60 } = options;
  return createE2EConvexClient().mutation(api.e2e.seedPlayingPassAndPlayGame, {
    secret: getE2ESecret(),
    promptCount,
    teamPlayers,
    turnDurationSeconds
  });
}

export async function getActivePlayerName(gameId: string) {
  return createE2EConvexClient().query(api.e2e.getActivePlayerName, {
    secret: getE2ESecret(),
    gameId: gameId as Id<"games">
  });
}

export async function loadSeededSnapshot(gameId: string): Promise<GameSnapshot> {
  return createE2EConvexClient().query(api.e2e.loadSeededSnapshot, {
    secret: getE2ESecret(),
    gameId: gameId as Id<"games">
  });
}

export async function advanceTurnWithAssignmentHelper(gameId: string) {
  await createE2EConvexClient().mutation(api.e2e.advanceTurnWithAssignmentHelper, {
    secret: getE2ESecret(),
    gameId: gameId as Id<"games">
  });
}

export async function setActiveTurnStartedAt(gameId: string, startedAt: string) {
  await createE2EConvexClient().mutation(api.e2e.setActiveTurnStartedAt, {
    secret: getE2ESecret(),
    gameId: gameId as Id<"games">,
    startedAt
  });
}
