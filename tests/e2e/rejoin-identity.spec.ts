import { expect, test } from "@playwright/test";
import { seedReadyPassAndPlayGame } from "./helpers/seed-game";
import { deleteTestGames } from "./helpers/supabase-cleanup";

test.describe("Refresh and rejoin identity", () => {
  const createdGameIds: string[] = [];

  test.afterEach(async () => {
    await deleteTestGames(createdGameIds);
    createdGameIds.length = 0;
  });

  test("keeps the same player identity after refresh", async ({ page }) => {
    const { gameId, hostPlayerId } = await seedReadyPassAndPlayGame();
    createdGameIds.push(gameId);

    await page.addInitScript(
      ({ seededGameId, seededHostPlayerId }) => {
        window.localStorage.setItem(`fish-bowl:${seededGameId}:player`, seededHostPlayerId);
      },
      { seededGameId: gameId, seededHostPlayerId: hostPlayerId }
    );

    await page.goto(`/game/${gameId}`);
    await expect(page.getByText("Austin is up")).toBeVisible();
    await expect(page.getByRole("button", { name: "Ready!" })).toBeVisible();

    await page.reload();

    await expect(page.getByText("Austin is up")).toBeVisible();
    await expect(page.getByRole("button", { name: "Ready!" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Join this game" })).toHaveCount(0);
  });
});
