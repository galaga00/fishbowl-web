import { expect, test } from "@playwright/test";
import { seedPlayingPassAndPlayGame } from "./helpers/seed-game";
import { createE2ESupabaseClient, deleteTestGames } from "./helpers/supabase-cleanup";

test.describe("Turn timer races", () => {
  const createdGameIds: string[] = [];

  test.afterEach(async () => {
    await deleteTestGames(createdGameIds);
    createdGameIds.length = 0;
  });

  test("auto-ending retries after a scoring action finishes saving", async ({ page }) => {
    const supabase = createE2ESupabaseClient();
    const { gameId, hostPlayerId } = await seedPlayingPassAndPlayGame({ promptCount: 3, turnDurationSeconds: 30 });
    createdGameIds.push(gameId);

    const { data: activeTurns, error } = await supabase
      .from("turns")
      .update({ started_at: new Date(Date.now() - 23_000).toISOString() })
      .eq("game_id", gameId)
      .is("ended_at", null)
      .select("id");
    if (error) throw error;
    expect(activeTurns).toHaveLength(1);

    await page.addInitScript(
      ({ seededGameId, seededHostPlayerId }) => {
        window.localStorage.setItem(`fish-bowl:${seededGameId}:player`, seededHostPlayerId);
      },
      { seededGameId: gameId, seededHostPlayerId: hostPlayerId }
    );

    let delayedCorrectSave = false;
    await page.route("**/rest/v1/prompts**", async (route) => {
      const request = route.request();
      const body = request.postData() ?? "";
      if (!delayedCorrectSave && request.method() === "PATCH" && body.includes("\"correct\"")) {
        delayedCorrectSave = true;
        await new Promise((resolve) => setTimeout(resolve, 9_000));
      }
      await route.continue();
    });

    await page.goto(`/game/${gameId}`);
    await expect(page.getByRole("button", { name: "Correct" })).toBeVisible();
    await expect(page.locator(".timer")).toHaveText(/^([1-9]|10)s$/);
    await page.getByRole("button", { name: "Correct" }).click();

    await expect(page.getByRole("button", { name: "Ready!" })).toBeVisible({ timeout: 25_000 });
  });
});
