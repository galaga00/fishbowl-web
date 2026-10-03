import type { Id } from "../../../convex/_generated/dataModel";
import type { GameSnapshot } from "../../../lib/types";

export function matchArgs(snapshot: GameSnapshot, sessionToken: string) {
  return { gameId: snapshot.game.id as Id<"games">, sessionToken, expectedMatchNumber: snapshot.game.match_number ?? 1 };
}

export function actionArgs(snapshot: GameSnapshot, sessionToken: string) {
  return {
    ...matchArgs(snapshot, sessionToken),
    expectedTurnId: snapshot.activeTurn?.id as Id<"turns"> | null ?? null,
    expectedPromptId: snapshot.game.current_prompt_id as Id<"prompts"> | null,
    expectedTeamId: snapshot.game.current_team_id as Id<"teams"> | null,
    expectedActivePlayerId: snapshot.game.active_player_id as Id<"players"> | null,
    expectedTurnNumber: snapshot.game.turn_number
  };
}

export function setupArgs(gameId: Id<"games">, sessionToken: string) {
  return { gameId, sessionToken, promptsPerPlayer: 1, teamNames: ["Team 1", "Team 2"], teamAssignmentMode: "auto" as const, promptMode: "deck" as "free" | "category" | "deck", expectedPlayers: 2, cardsDealtPerPlayer: 4, cardsKeptPerPlayer: 2, turnDurationSeconds: 60, playMode: "multi_device" as "multi_device" | "pass_and_play", passAndPlayPlayers: [{ name: "Host", teamIndex: 0 }, { name: "Guest", teamIndex: 1 }], passPlayCardCount: 20, passPlayCategories: ["mixed"], promptCategories: ["mixed"] };
}
