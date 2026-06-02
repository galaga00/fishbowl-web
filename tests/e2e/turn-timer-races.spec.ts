import { expect, test } from "@playwright/test";
import { seedPlayingPassAndPlayGame, setActiveTurnStartedAt } from "./helpers/seed-game";
import { deleteTestGames } from "./helpers/convex-cleanup";

test.describe("Turn timer races", () => {
  const createdGameIds: string[] = [];

  test.afterEach(async () => {
    await deleteTestGames(createdGameIds);
    createdGameIds.length = 0;
  });

  test("auto-ending still advances after a scoring action near the timer boundary", async ({ page }) => {
    const { gameId, hostPlayerId } = await seedPlayingPassAndPlayGame({ promptCount: 3, turnDurationSeconds: 30 });
    createdGameIds.push(gameId);

    await setActiveTurnStartedAt(gameId, new Date(Date.now() - 24_000).toISOString());

    await page.addInitScript(
      ({ seededGameId, seededHostPlayerId }) => {
        window.localStorage.setItem(`fish-bowl:${seededGameId}:player`, seededHostPlayerId);
      },
      { seededGameId: gameId, seededHostPlayerId: hostPlayerId }
    );

    await page.goto(`/game/${gameId}`);
    await expect(page.getByRole("button", { name: "Correct" })).toBeVisible();
    await expect(page.locator(".timer")).toHaveText(/^([1-9]|10)s$/);
    await page.getByRole("button", { name: "Correct" }).click();

    await expect(page.getByRole("button", { name: "Ready!" })).toBeVisible({ timeout: 25_000 });
  });
});
