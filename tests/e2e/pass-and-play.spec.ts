import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { deleteTestGames } from "./helpers/convex-cleanup";
import { seedReadyPassAndPlayGame } from "./helpers/seed-game";

test.describe("Pass & Play game loop", () => {
  const createdGameIds: string[] = [];

  test.afterEach(async () => {
    await deleteTestGames(createdGameIds);
    createdGameIds.length = 0;
  });

  async function clickIfStillOnPage(page: Page, buttonName: string, nextHeading: string) {
    const nextStep = page.getByRole("heading", { name: nextHeading });
    if (await nextStep.isVisible().catch(() => false)) return;

    const button = page.getByRole("button", { name: buttonName });
    await expect(button).toBeVisible();
    if (await button.isEnabled()) {
      await button.click();
    }
    await expect(nextStep).toBeVisible();
  }

  async function startPassAndPlayTurn(page: Page, cardCount = 10) {
    await page.goto("/");

    await expect(page.getByRole("heading", { name: "Fish Bowl" })).toBeVisible();
    await page.getByRole("button", { name: "Create Game" }).click();

    await expect(page.getByRole("heading", { name: "Mode" })).toBeVisible();
    const gameId = page.url().match(/\/game\/([^/?#]+)/)?.[1];
    expect(gameId).toBeTruthy();
    createdGameIds.push(gameId!);

    await page.getByRole("button", { name: /Pass & Play/ }).click();
    await page.getByRole("button", { name: "Next", exact: true }).click();

    await expect(page.getByRole("heading", { name: "Prompts" })).toBeVisible();
    await page.locator("#passCardCount").fill(String(cardCount));
    await page.locator("#passCardCount").blur();
    await page.getByRole("button", { name: "Next", exact: true }).click();

    await expect(page.getByRole("heading", { name: "Teams" })).toBeVisible();
    await page.getByRole("button", { name: "Next", exact: true }).click();

    await expect(page.getByRole("heading", { name: "Review" })).toBeVisible();
    await clickIfStillOnPage(page, "Create lobby", "Lobby");
    await expect(page.getByText(`${cardCount} cards are loaded`)).toBeVisible();
    await expect(page.getByRole("button", { name: "Start game" })).toBeEnabled();
    await page.getByRole("button", { name: "Start game" }).click();

    await expect(page.getByRole("button", { name: "Ready!" })).toBeVisible();
    await page.getByRole("button", { name: "Ready!" }).click();

    await expect(page.getByRole("button", { name: "Correct" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Skip" })).toBeEnabled();
  }

  test("host can create a game, start a turn, and score prompts without visible browser juggling", async ({ page }) => {
    await startPassAndPlayTurn(page);

    await page.getByRole("button", { name: "Correct" }).click();
    await expect(page.getByRole("button", { name: "Undo last" })).toBeEnabled();

    const prompt = page.locator(".prompt");
    const promptBeforeSkip = await prompt.textContent();
    await page.getByRole("button", { name: "Skip" }).click();
    await expect(prompt).not.toHaveText(promptBeforeSkip ?? "");
    await expect(page.getByRole("button", { name: "End turn" })).toBeEnabled();
    await page.getByRole("button", { name: "End turn" }).click();
    await expect(page.getByText("End this turn?")).toBeVisible();
    await expect(page.getByRole("button", { name: "End now" })).toBeVisible();
    await page.getByRole("button", { name: "Cancel" }).click();
    await expect(page.getByRole("button", { name: "End turn" })).toBeVisible();
  });

  test("skip is disabled with a visible note on the last card", async ({ page }) => {
    await startPassAndPlayTurn(page);

    const correctButton = page.getByRole("button", { name: "Correct" });
    for (let index = 0; index < 9; index += 1) {
      await correctButton.click();
    }

    await expect(page.getByText("This is the last card. Mark it correct or end the turn.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Skip" })).toBeDisabled();
    await expect(page.getByRole("button", { name: "End turn" })).toBeEnabled();
  });

  test("host can adjust team scores from play controls", async ({ page }) => {
    await startPassAndPlayTurn(page);

    const teamOneScore = page.locator(".score", { hasText: "Team 1" });
    await expect(teamOneScore.locator("strong")).toHaveText("0");
    await expect(page.getByRole("button", { name: "Remove point from Team 1" })).toBeDisabled();

    await page.getByRole("button", { name: "Add point to Team 1" }).click();
    await expect(teamOneScore.locator("strong")).toHaveText("1");
    await expect(page.getByRole("button", { name: "Remove point from Team 1" })).toBeEnabled();

    await page.getByRole("button", { name: "Remove point from Team 1" }).click();
    await expect(teamOneScore.locator("strong")).toHaveText("0");
    await expect(page.getByRole("button", { name: "Remove point from Team 1" })).toBeDisabled();
  });

  test("host can redo the current turn's last prompts after pausing", async ({ page }) => {
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
    await page.getByRole("button", { name: "Ready!" }).click();

    await expect(page.locator(".prompt")).toHaveText("Prompt 1");
    await page.getByRole("button", { name: "Correct" }).click();
    await expect(page.locator(".score", { hasText: "Team 1" }).locator("strong")).toHaveText("1");
    await expect(page.locator(".prompt")).toHaveText("Prompt 2");

    await page.getByRole("button", { name: "Correct" }).click();
    await expect(page.locator(".score", { hasText: "Team 1" }).locator("strong")).toHaveText("2");
    await expect(page.locator(".prompt")).toHaveText("Prompt 3");

    await page.getByRole("button", { name: "Pause" }).click();
    await expect(page.getByText("Game paused")).toBeVisible();

    page.once("dialog", async (dialog) => {
      expect(dialog.message()).toContain("Redo this player's last few prompts");
      await dialog.accept();
    });
    await page.getByRole("button", { name: "Redo last 5" }).click();
    await expect(page.locator(".score", { hasText: "Team 1" }).locator("strong")).toHaveText("0");

    await page.getByRole("button", { name: "Resume" }).click();
    await expect(page.locator(".prompt")).toHaveText("Prompt 1");
    await expect(page.locator(".timer")).toHaveText(/1[3-5]s/);
  });
});
