import { expect, test } from "@playwright/test";
import { createGame, joinGame, loadSnapshot, markCorrect, saveGameSetup, skipPrompt } from "../../lib/game-api";
import { getFirstTurnAssignment, getNextTurnAssignment, getPromptForPlayerTurn } from "../../lib/game-utils";
import { FAMILY_FRIENDLY_DECK_FILTER, filterStarterDeckByCategories, MIXED_PASS_PLAY_CATEGORY } from "../../lib/pass-play-deck";
import { seedPlayingPassAndPlayGame, loadSeededSnapshot } from "./helpers/seed-game";
import { deleteTestGames, loadLocalEnv } from "./helpers/convex-cleanup";
import type { GameSnapshot } from "../../lib/types";

test.describe("Deck and scoring invariants", () => {
  const createdGameIds: string[] = [];

  test.beforeAll(() => {
    loadLocalEnv();
  });

  test.afterEach(async () => {
    await deleteTestGames(createdGameIds);
    createdGameIds.length = 0;
  });

  test("dealable starter decks do not contain duplicate visible titles", () => {
    for (const categories of [[MIXED_PASS_PLAY_CATEGORY], [MIXED_PASS_PLAY_CATEGORY, FAMILY_FRIENDLY_DECK_FILTER]]) {
      const cards = filterStarterDeckByCategories(categories);
      const titles = cards.map((card) => normalizeVisibleTitle(card.title));
      expect(new Set(titles).size).toBe(titles.length);
    }
  });

  test("first turn assignment can start on a non-host team without breaking rotation", () => {
    const snapshot = buildRotationSnapshot();
    const firstAssignment = getFirstTurnAssignment(snapshot, 1);

    expect(firstAssignment?.team.name).toBe("Team 2");
    expect(firstAssignment?.player.name).toBe("Casey");

    const afterFirstTurn = withTurnAssignment(snapshot, firstAssignment!, 1);
    const secondAssignment = getNextTurnAssignment(afterFirstTurn);

    expect(secondAssignment?.team.name).toBe("Team 1");
    expect(secondAssignment?.player.name).toBe("Austin");

    const afterSecondTurn = withTurnAssignment(afterFirstTurn, secondAssignment!, 2);
    const thirdAssignment = getNextTurnAssignment(afterSecondTurn);

    expect(thirdAssignment?.team.name).toBe("Team 2");
    expect(thirdAssignment?.player.name).toBe("Drew");
  });

  test("prompt selection avoids the active player's own prompt when possible", () => {
    const prompts = [
      buildPrompt("prompt-1", "player-1"),
      buildPrompt("prompt-2", "player-2"),
      buildPrompt("prompt-3", "player-1")
    ];

    expect(getPromptForPlayerTurn(prompts, "player-1")?.id).toBe("prompt-2");
    expect(getPromptForPlayerTurn(prompts, "player-1", "prompt-2")?.id).toBe("prompt-1");
    expect(getPromptForPlayerTurn([buildPrompt("prompt-4", "player-1")], "player-1")?.id).toBe("prompt-4");
  });

  test("parallel deck-draft joins receive unique visible card titles", async () => {
    const { game } = await createGame("Austin");
    createdGameIds.push(game.id);

    await saveGameSetup(
      game.id,
      3,
      ["Team 1", "Team 2", "Team 3"],
      "auto",
      "deck",
      3,
      10,
      5,
      60,
      "multi_device",
      [],
      30,
      [MIXED_PASS_PLAY_CATEGORY],
      [MIXED_PASS_PLAY_CATEGORY]
    );

    await Promise.all([joinGame(game.code, "Briar"), joinGame(game.code, "Casey")]);

    const snapshot = await loadSnapshot(game.id);
    const titles = snapshot.draftCards.map((card) => normalizeVisibleTitle(card.title));
    expect(titles).toHaveLength(30);
    expect(new Set(titles).size).toBe(30);
  });

  test("a stale duplicate Correct action cannot score the same prompt twice", async () => {
    const { gameId } = await seedPlayingPassAndPlayGame({ promptCount: 2 });
    createdGameIds.push(gameId);

    const snapshot = await loadSeededSnapshot(gameId);
    await Promise.all([markCorrect(snapshot), markCorrect(snapshot)]);

    const result = await loadSeededSnapshot(gameId);
    const totalScore = result.teams.reduce((sum, team) => sum + team.score, 0);
    expect(totalScore).toBe(1);
  });

  test("a stale Skip action cannot revive a prompt after it was scored", async () => {
    const { gameId } = await seedPlayingPassAndPlayGame({ promptCount: 2 });
    createdGameIds.push(gameId);

    const snapshot = await loadSeededSnapshot(gameId);
    await markCorrect(snapshot);
    await skipPrompt(snapshot);

    const result = await loadSeededSnapshot(gameId);
    const scoredPrompt = result.prompts.find((prompt) => prompt.id === snapshot.game.current_prompt_id);
    expect(scoredPrompt?.status).toBe("correct");
    expect(result.game.current_prompt_id).not.toBe(snapshot.game.current_prompt_id);
  });
});

function normalizeVisibleTitle(title: string) {
  return title
    .toLowerCase()
    .replace(/^the\s+/, "")
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function withTurnAssignment(
  snapshot: GameSnapshot,
  assignment: NonNullable<ReturnType<typeof getFirstTurnAssignment>>,
  turnNumber: number
): GameSnapshot {
  return {
    ...snapshot,
    game: {
      ...snapshot.game,
      active_player_id: assignment.player.id,
      current_team_id: assignment.team.id,
      turn_number: turnNumber
    }
  };
}

function buildRotationSnapshot(): GameSnapshot {
  const gameId = "game-1";
  return {
    game: {
      id: gameId,
      code: "ABCDE",
      host_player_id: "player-1",
      phase: "ready",
      current_team_id: null,
      active_player_id: null,
      current_prompt_id: null,
      turn_number: 0,
      round_number: 1,
      turn_duration_seconds: 60,
      prompts_per_player: 3,
      cards_dealt_per_player: 10,
      cards_kept_per_player: 5,
      pass_play_card_count: 10,
      expected_players: 4,
      team_assignment_mode: "auto",
      prompt_mode: "deck",
      prompt_categories: ["mixed"],
      play_mode: "pass_and_play",
      paused_at: null,
      created_at: "2026-01-01T00:00:00.000Z"
    },
    players: [
      buildPlayer("player-1", gameId, "Austin", true, "team-1", 0),
      buildPlayer("player-2", gameId, "Briar", false, "team-1", 1),
      buildPlayer("player-3", gameId, "Casey", false, "team-2", 2),
      buildPlayer("player-4", gameId, "Drew", false, "team-2", 3)
    ],
    teams: [
      { id: "team-1", game_id: gameId, name: "Team 1", score: 0, sort_order: 0 },
      { id: "team-2", game_id: gameId, name: "Team 2", score: 0, sort_order: 1 }
    ],
    prompts: [],
    draftCards: [],
    activeTurn: null,
    latestUndoableEvent: null
  };
}

function buildPlayer(id: string, gameId: string, name: string, isHost: boolean, teamId: string, order: number) {
  return {
    id,
    game_id: gameId,
    name,
    is_host: isHost,
    team_id: teamId,
    has_submitted: true,
    created_at: new Date(Date.UTC(2026, 0, 1, 0, 0, order)).toISOString()
  };
}

function buildPrompt(id: string, playerId: string) {
  return {
    id,
    game_id: "game-1",
    player_id: playerId,
    text: id,
    category: null,
    description: null,
    status: "available" as const,
    deck_order: null,
    created_at: "2026-01-01T00:00:00.000Z"
  };
}
