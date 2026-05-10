import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { deleteTestGames } from "./helpers/supabase-cleanup";

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

  test("host can create a game, start a turn, and score prompts without visible browser juggling", async ({ page }) => {
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
    await page.locator("#passCardCount").fill("10");
    await page.locator("#passCardCount").blur();
    await page.getByRole("button", { name: "Next", exact: true }).click();

    await expect(page.getByRole("heading", { name: "Teams" })).toBeVisible();
    await page.getByRole("button", { name: "Next", exact: true }).click();

    await expect(page.getByRole("heading", { name: "Review" })).toBeVisible();
    await clickIfStillOnPage(page, "Create lobby", "Lobby");
    await expect(page.getByText("10 cards are loaded")).toBeVisible();
    await expect(page.getByRole("button", { name: "Start game" })).toBeEnabled();
    await page.getByRole("button", { name: "Start game" }).click();

    await expect(page.getByRole("button", { name: "Ready!" })).toBeVisible();
    await page.getByRole("button", { name: "Ready!" }).click();

    await expect(page.getByRole("button", { name: "Correct" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Skip" })).toBeVisible();
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
});
