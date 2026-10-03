import { expect, test, type Page } from "@playwright/test";
import { api } from "../../convex/_generated/api";
import { createE2EConvexClient, deleteTestGames } from "./helpers/convex-cleanup";
import { loadSeededSnapshot, seedReadyPassAndPlayGame } from "./helpers/seed-game";
import { matchArgs } from "./helpers/game-args";

const ids: string[] = [];
let dialogs: string[] = [];
test.beforeEach(async ({ page }) => {
  dialogs = [];
  page.on("dialog", async (dialog) => { dialogs.push(dialog.type()); await dialog.dismiss(); });
  await page.addInitScript(() => localStorage.setItem("fish-bowl-ignore-analytics", "true"));
});
test.afterEach(async () => {
  await deleteTestGames(ids);
  ids.length = 0;
  expect(dialogs).toEqual([]);
});

async function createInBrowser(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "Create Game", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Mode", exact: true })).toBeVisible();
  const gameId = page.url().split("/game/")[1];
  ids.push(gameId);
  return gameId;
}

async function useSeed(page: Page) {
  const seed = await seedReadyPassAndPlayGame({ promptCount: 3 });
  ids.push(seed.gameId);
  await page.addInitScript(({ gameId, sessionToken }) => localStorage.setItem(`fish-bowl:${gameId}:session`, sessionToken), seed);
  await page.goto(`/game/${seed.gameId}`);
  return seed;
}

test("capacity recovery is inline and Review never submits itself", async ({ page }) => {
  const gameId = await createInBrowser(page);
  await page.getByRole("button", { name: /Pass & Play/ }).click();
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await page.locator("#passCardCount").fill("80");
  await page.getByRole("button", { name: /Internet & Memes/ }).click();
  await expect(page.getByText("44 unique cards in these categories. 80 requested.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Next", exact: true })).toBeDisabled();
  await page.getByRole("button", { name: "Use 44 cards", exact: true }).click();
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Review", exact: true })).toBeVisible();
  expect((await loadSeededSnapshot(gameId)).game.phase).toBe("setup");
  await page.getByRole("button", { name: "Create lobby", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Card deck ready" })).toBeVisible();
  await page.getByRole("button", { name: "Edit setup" }).click();
  await page.getByRole("button", { name: "Go to Prompts" }).click();
  await expect(page.locator("#passCardCount")).toHaveValue("44");
  await expect(page.getByRole("button", { name: /Internet & Memes/ })).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Cancel editing" }).click();
  await expect(page.getByRole("button", { name: "Start game", exact: true })).toBeEnabled();
});

test("quick start completes all three rounds and offers a fresh rematch", async ({ page }) => {
  test.setTimeout(300_000);
  const gameId = await createInBrowser(page);
  await page.getByRole("button", { name: /Quick 20 cards/ }).click();
  await page.getByRole("button", { name: "Start quick game" }).click();
  await expect(page.getByRole("button", { name: "Ready!", exact: true })).toBeVisible();
  const before = await loadSeededSnapshot(gameId);
  const originalTitles = new Set(before.prompts.map((prompt) => prompt.text));
  expect(before.game.turn_duration_seconds).toBe(30);
  // A slow browser can reach the real 30-second deadline. Keep playing through
  // normal handoffs instead of assuming every round fits into a single turn.
  const progressKey = (snapshot: Awaited<ReturnType<typeof loadSeededSnapshot>>) =>
    `${snapshot.game.phase}:${snapshot.game.round_number}:${snapshot.game.current_prompt_id}:${snapshot.activeTurn?.id}`;
  let current = before;
  for (let action = 0; action < 200 && current.game.phase !== "finished"; action += 1) {
    const previousKey = progressKey(current);
    const control = page.getByRole("button", { name: /^(Ready!|Correct)$/ });
    await expect(control).toBeEnabled();
    await control.click();
    await expect.poll(async () => {
      current = await loadSeededSnapshot(gameId);
      return progressKey(current);
    }).not.toBe(previousKey);
  }
  await expect(page.getByRole("heading", { name: "Game finished" })).toBeVisible();
  const finished = await loadSeededSnapshot(gameId);
  expect(finished.teams.reduce((score, team) => score + team.score, 0)).toBe(60);
  expect(finished.game.finish_reason).toBe("completed");
  await page.getByRole("button", { name: "Play again · fresh bowl" }).click();
  await page.getByRole("button", { name: "Prepare new game" }).click();
  await expect(page.getByRole("heading", { name: "Lobby", exact: true })).toBeVisible();
  const fresh = await loadSeededSnapshot(gameId);
  expect(fresh.prompts.every((prompt) => !originalTitles.has(prompt.text))).toBe(true);
});

test("a player ID alone cannot reclaim the host; the private recovery code can", async ({ page }) => {
  const seed = await seedReadyPassAndPlayGame({ promptCount: 3 });
  ids.push(seed.gameId);
  await page.addInitScript(({ gameId, hostPlayerId }) => localStorage.setItem(`fish-bowl:${gameId}:player`, hostPlayerId), seed);
  await page.goto(`/game/${seed.gameId}`);
  await expect(page.getByRole("heading", { name: "Use the shared phone" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Ready!" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Austin", exact: true })).toHaveCount(0);
  await page.getByText("Rejoin with a recovery code", { exact: true }).click();
  await page.getByLabel("Recovery code", { exact: true }).fill(seed.sessionToken);
  await page.getByRole("button", { name: "Recover my seat" }).click();
  await expect(page.getByRole("button", { name: "Ready!" })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("button", { name: "Ready!" })).toBeVisible();
  await page.getByRole("link", { name: "Home", exact: true }).click();
  await page.getByRole("link", { name: "Continue my game" }).click();
  await expect(page.getByRole("button", { name: "Ready!" })).toBeVisible();
});

test("play controls fit phones, tablets, and desktops; paused time survives refresh", async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const seed = await useSeed(page);
  await page.getByRole("button", { name: "Ready!" }).click();
  for (const viewport of [{ width: 320, height: 720 }, { width: 390, height: 844 }, { width: 820, height: 1180 }, { width: 1440, height: 1000 }]) {
    await page.setViewportSize(viewport);
    await page.evaluate(() => window.scrollTo(0, 0));
    await expect(page.locator(".prompt")).toHaveText("Prompt 1");
    const correct = page.getByRole("button", { name: "Correct", exact: true });
    const box = await correct.boundingBox();
    expect(box).toBeTruthy();
    expect(box!.height).toBeGreaterThanOrEqual(44);
    expect(box!.y + box!.height).toBeLessThan(viewport.height);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath(`playing-${viewport.width}.png`), fullPage: true });
  }
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  const remaining = await page.getByText(/\d+s remaining\. Your card stays hidden/).textContent();
  await expect(page.locator(".prompt")).toHaveCount(0);
  await page.reload();
  await expect(page.getByText(remaining!, { exact: true })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("paused.png"), fullPage: true });
  const snapshot = await loadSeededSnapshot(seed.gameId);
  await createE2EConvexClient().mutation(api.game.finishGame, matchArgs(snapshot, seed.sessionToken));
  await expect(page.getByText("The host ended this game. Here are the final scores.")).toBeVisible();
  expect(errors).toEqual([]);
});

test("unknown rooms offer an exit without crashing the page", async ({ page }) => {
  await page.goto("/game/not-a-room");
  await expect(page.getByText("Could not open this game")).toBeVisible();
  await expect(page.getByRole("link", { name: "Home", exact: true })).toBeVisible();
});
