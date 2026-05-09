import { expect, test } from "@playwright/test";
import { advanceTurnWithAssignmentHelper, getActivePlayerName, seedReadyPassAndPlayGame } from "./helpers/seed-game";
import { deleteTestGames } from "./helpers/supabase-cleanup";

test.describe("Turn rotation", () => {
  const createdGameIds: string[] = [];

  test.afterEach(async () => {
    await deleteTestGames(createdGameIds);
    createdGameIds.length = 0;
  });

  test("rotates clue giver within a team when play cycles back to that team", async ({ page }) => {
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
    await advanceTurnWithAssignmentHelper(gameId);

    await expect.poll(() => getActivePlayerName(gameId)).toBe("Casey");
    await expect(page.getByText("Casey is up")).toBeVisible();
    await advanceTurnWithAssignmentHelper(gameId);

    await expect(page.getByText("Briar is up")).toBeVisible();
  });

  test("rotates clue givers fairly across uneven teams", async ({ page }) => {
    const { gameId, hostPlayerId } = await seedReadyPassAndPlayGame({
      teamPlayers: [
        ["Austin", "Briar", "Cam"],
        ["Devon", "Elliot"]
      ]
    });
    createdGameIds.push(gameId);

    await page.addInitScript(
      ({ seededGameId, seededHostPlayerId }) => {
        window.localStorage.setItem(`fish-bowl:${seededGameId}:player`, seededHostPlayerId);
      },
      { seededGameId: gameId, seededHostPlayerId: hostPlayerId }
    );

    await page.goto(`/game/${gameId}`);

    await expect(page.getByText("Austin is up")).toBeVisible();
    await advanceTurnWithAssignmentHelper(gameId);
    await expect.poll(() => getActivePlayerName(gameId)).toBe("Devon");
    await expect(page.getByText("Devon is up")).toBeVisible();

    await advanceTurnWithAssignmentHelper(gameId);
    await expect.poll(() => getActivePlayerName(gameId)).toBe("Briar");
    await expect(page.getByText("Briar is up")).toBeVisible();

    await advanceTurnWithAssignmentHelper(gameId);
    await expect.poll(() => getActivePlayerName(gameId)).toBe("Elliot");
    await expect(page.getByText("Elliot is up")).toBeVisible();

    await advanceTurnWithAssignmentHelper(gameId);
    await expect.poll(() => getActivePlayerName(gameId)).toBe("Cam");
    await expect(page.getByText("Cam is up")).toBeVisible();
  });
});
