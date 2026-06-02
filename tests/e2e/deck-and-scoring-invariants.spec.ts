import { expect, test } from "@playwright/test";
import { createGame, joinGame, loadSnapshot, markCorrect, saveGameSetup, skipPrompt } from "../../lib/game-api";
import { FAMILY_FRIENDLY_DECK_FILTER, filterStarterDeckByCategories, MIXED_PASS_PLAY_CATEGORY } from "../../lib/pass-play-deck";
import { seedPlayingPassAndPlayGame, loadSeededSnapshot } from "./helpers/seed-game";
import { deleteTestGames, loadLocalEnv } from "./helpers/convex-cleanup";

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
