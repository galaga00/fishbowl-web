import { expect, test } from "@playwright/test";
import { seedReadyPassAndPlayGame } from "./helpers/seed-game";
import { deleteTestGames } from "./helpers/supabase-cleanup";

test.describe("Round transition", () => {
  const createdGameIds: string[] = [];

  test.afterEach(async () => {
    await deleteTestGames(createdGameIds);
    createdGameIds.length = 0;
  });

  test("moves to round two after all round-one prompts are guessed", async ({ page }) => {
    const { gameId, hostPlayerId } = await seedReadyPassAndPlayGame({ promptCount: 2 });
    createdGameIds.push(gameId);

    await page.addInitScript(
      ({ seededGameId, seededHostPlayerId }) => {
        window.localStorage.setItem(`fish-bowl:${seededGameId}:player`, seededHostPlayerId);
      },
      { seededGameId: gameId, seededHostPlayerId: hostPlayerId }
    );

    await page.goto(`/game/${gameId}`);

    await expect(page.getByText("Austin is up")).toBeVisible();
    await page.getByRole("button", { name: "Ready!" }).click();
    await expect(page.locator(".prompt")).toHaveText("Prompt 1");
    await page.getByRole("button", { name: "Correct" }).click();

    await expect(page.locator(".prompt")).toHaveText("Prompt 2");
    await page.getByRole("button", { name: "Correct" }).click();

    await expect(page.getByText("Next up: One Word")).toBeVisible();
    await expect(page.getByText("Round 2")).toBeVisible();
    await expect(page.getByRole("button", { name: "Ready!" })).toBeVisible();
  });
});
