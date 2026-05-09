import { expect, test } from "@playwright/test";
import { createGame, joinGame, markCorrect, saveGameSetup } from "../../lib/game-api";
import { FAMILY_FRIENDLY_DECK_FILTER, filterStarterDeckByCategories, MIXED_PASS_PLAY_CATEGORY } from "../../lib/pass-play-deck";
import { seedReadyPassAndPlayGame, loadSeededSnapshot } from "./helpers/seed-game";
import { createE2ESupabaseClient, deleteTestGames, loadLocalEnv } from "./helpers/supabase-cleanup";

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
    const supabase = createE2ESupabaseClient();
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

    const { data, error } = await supabase
      .from("draft_cards")
      .select("title")
      .eq("game_id", game.id);

    if (error) throw error;

    const titles = (data ?? []).map((card) => normalizeVisibleTitle(card.title as string));
    expect(titles).toHaveLength(30);
    expect(new Set(titles).size).toBe(30);
  });

  test("a stale duplicate Correct action cannot score the same prompt twice", async () => {
    const supabase = createE2ESupabaseClient();
    const { gameId } = await seedReadyPassAndPlayGame({ promptCount: 2 });
    createdGameIds.push(gameId);

    const snapshot = await loadSeededSnapshot(gameId);
    await Promise.all([markCorrect(snapshot), markCorrect(snapshot)]);

    const { data: teams, error: teamError } = await supabase
      .from("teams")
      .select("score")
      .eq("game_id", gameId);
    if (teamError) throw teamError;

    const totalScore = (teams ?? []).reduce((sum, team) => sum + (team.score as number), 0);
    expect(totalScore).toBe(1);
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
