import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { deleteTestGames } from "./helpers/supabase-cleanup";

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

test.describe("Multiplayer joining", () => {
  const createdGameIds: string[] = [];

  test.afterEach(async () => {
    await deleteTestGames(createdGameIds);
    createdGameIds.length = 0;
  });

  test("a second browser context can join by code and host sees the player", async ({ browser, page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Create Game" }).click();

    await expect(page.getByRole("heading", { name: "Mode" })).toBeVisible();
    const gameId = page.url().match(/\/game\/([^/?#]+)/)?.[1];
    expect(gameId).toBeTruthy();
    createdGameIds.push(gameId!);

    await page.getByRole("button", { name: "Next", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Prompts" })).toBeVisible();
    await page.getByRole("button", { name: "Next", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Teams" })).toBeVisible();
    await page.getByRole("button", { name: "Next", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Review" })).toBeVisible();
    await clickIfStillOnPage(page, "Create lobby", "Lobby");

    const joinCode = (await page.locator(".code").textContent())?.trim();
    expect(joinCode).toBeTruthy();

    const playerContext = await browser.newContext();
    const playerPage = await playerContext.newPage();
    try {
      await playerPage.goto("/");
      await playerPage.getByRole("button", { name: "Join Game" }).click();
      await playerPage.getByLabel("Your name").fill("Mira");
      await playerPage.getByLabel("Join code").fill(joinCode!);
      await playerPage.getByRole("button", { name: "Join Game" }).click();

      await expect(playerPage.getByRole("heading", { name: "Team selected" })).toBeVisible();
      await expect(playerPage.getByText(/You're on Team/)).toBeVisible();
      await playerPage.getByRole("button", { name: "Continue" }).click();
      await expect(playerPage.getByRole("heading", { name: "Lobby" })).toBeVisible();
      await expect(page.getByText("Mira")).toBeVisible();

      await playerPage.getByLabel("Prompts").fill(["Moon landing", "Pizza oven", "Tap dance"].join("\n"));
      await playerPage.getByRole("button", { name: "Submit 3 prompts" }).click();
      await expect(playerPage.getByText("You're ready. Waiting for the host to start.")).toBeVisible();
      await expect(playerPage.locator(".ready-toast")).toBeVisible();
    } finally {
      await playerContext.close();
    }
  });

  test("a joining player chooses a team before picking cards", async ({ browser, page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Create Game" }).click();

    await expect(page.getByRole("heading", { name: "Mode" })).toBeVisible();
    const gameId = page.url().match(/\/game\/([^/?#]+)/)?.[1];
    expect(gameId).toBeTruthy();
    createdGameIds.push(gameId!);

    await page.getByRole("button", { name: "Next", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Prompts" })).toBeVisible();
    await page.getByRole("button", { name: "Deck draft" }).click();
    await page.getByRole("button", { name: "Next", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Teams" })).toBeVisible();
    await page.getByRole("button", { name: "Players choose" }).click();
    await page.getByRole("button", { name: "Next", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Review" })).toBeVisible();
    await clickIfStillOnPage(page, "Create lobby", "Lobby");

    const joinCode = (await page.locator(".code").textContent())?.trim();
    expect(joinCode).toBeTruthy();

    const playerContext = await browser.newContext();
    const playerPage = await playerContext.newPage();
    try {
      await playerPage.goto("/");
      await playerPage.getByRole("button", { name: "Join Game" }).click();
      await playerPage.getByLabel("Your name").fill("Noor");
      await playerPage.getByLabel("Join code").fill(joinCode!);
      await playerPage.getByRole("button", { name: "Join Game" }).click();

      await expect(playerPage.getByRole("heading", { name: "Pick a team" })).toBeVisible();
      await playerPage.getByRole("button", { name: "Team 2" }).click();
      await expect(playerPage.getByRole("heading", { name: "Team selected" })).toBeVisible();
      await expect(playerPage.getByText("You're on Team 2.")).toBeVisible();
      await playerPage.getByRole("button", { name: "Continue" }).click();
      await expect(playerPage.getByRole("heading", { name: "Pick your cards" })).toBeVisible();

      const draftCards = playerPage.locator(".draft-card");
      for (let index = 0; index < 5; index += 1) {
        await draftCards.nth(index).click();
      }
      await expect(playerPage.getByText("You're ready. Waiting for the host to start.")).toBeVisible();
      await expect(playerPage.locator(".pick-order", { hasText: "5 / 5" })).toBeVisible();
      await expect(playerPage.locator(".ready-toast")).toBeVisible();

      await draftCards.nth(0).click();
      await expect(playerPage.getByText("You have picked 4 of 5.")).toBeVisible();
      await expect(playerPage.locator(".ready-toast")).toHaveCount(0);
    } finally {
      await playerContext.close();
    }
  });
});
