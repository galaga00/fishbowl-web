import { expect, test, type Page } from "@playwright/test";
import { api } from "../../convex/_generated/api";
import { createE2EConvexClient, deleteTestGames } from "./helpers/convex-cleanup";
import { matchArgs } from "./helpers/game-args";
import { loadSeededSnapshot } from "./helpers/seed-game";

const ids: string[] = [];
test.beforeEach(async ({ context }) => {
  await context.addInitScript(() => localStorage.setItem("fish-bowl-ignore-analytics", "true"));
});
test.afterEach(async () => { await deleteTestGames(ids); ids.length = 0; });

async function createCustomGame(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "Create Game", exact: true }).click();
  await page.getByRole("button", { name: "Custom game", exact: true }).click();
  const id = page.url().split("/game/")[1];
  ids.push(id);
  return id;
}

async function selectVersion(page: Page, version: "V1" | "V2") {
  await page.getByRole("button", { name: "Change game version", exact: true }).click();
  await page.getByRole("button", { name: new RegExp(`^${version} —`) }).click();
  await expect(page.getByLabel("Selected game version", { exact: true })).toContainText(version);
}

test("written prompts follow the group size until the host changes the count", async ({ page }) => {
  await createCustomGame(page);
  await page.getByRole("button", { name: "Go to Prompts", exact: true }).click();
  await expect(page.getByLabel("Prompts per player", { exact: true })).toHaveValue("3");
  await expect(page.locator("#prompt-count-estimate")).toContainText("Enter Expected players");
  for (const [players, prompts] of [[4, 10], [6, 7], [8, 5], [200, 1]]) {
    await page.getByRole("button", { name: "Go to Mode", exact: true }).click();
    await page.getByLabel("Expected players").fill(String(players));
    await page.getByRole("button", { name: "Go to Prompts", exact: true }).click();
    await expect(page.getByLabel("Prompts per player", { exact: true })).toHaveValue(String(prompts));
    await expect(page.locator("#prompt-count-estimate")).toContainText(`${players * prompts} cards`);
    // Merely focusing and leaving the input must not disable automatic suggestions.
    await page.getByLabel("Prompts per player", { exact: true }).focus();
  }
  await page.getByRole("button", { name: "Go to Mode", exact: true }).click();
  await page.getByLabel("Expected players").fill("6");
  await page.getByRole("button", { name: "Go to Prompts", exact: true }).click();
  await expect(page.locator("#prompt-count-estimate")).toContainText("6 players × 7 prompts = 42 cards");
  await page.getByRole("button", { name: /Category prompts/ }).click();
  await expect(page.getByLabel("Prompts per player", { exact: true })).toHaveValue("7");
  await page.getByRole("button", { name: /Deck draft/ }).click();
  await expect(page.locator("#prompt-count-estimate")).toHaveCount(0);
  await expect(page.getByLabel("Cards kept", { exact: true })).toHaveValue("5");
  await page.getByRole("button", { name: /Anything goes/ }).click();
  await page.getByLabel("Prompts per player", { exact: true }).fill("5");
  await page.getByRole("button", { name: "Go to Mode", exact: true }).click();
  await page.getByLabel("Expected players").fill("8");
  await page.getByRole("button", { name: "Go to Prompts", exact: true }).click();
  await expect(page.getByLabel("Prompts per player", { exact: true })).toHaveValue("5");
  await page.getByRole("button", { name: "Quick game", exact: true }).click();
  await page.getByRole("button", { name: "Custom game", exact: true }).click();
  await selectVersion(page, "V1");
  await expect(page.getByLabel("Prompts per player", { exact: true })).toHaveValue("5");
  await selectVersion(page, "V2");
  await page.getByRole("button", { name: "Go to Mode", exact: true }).click();
  await page.getByLabel("Expected players").fill("6");
  await page.getByRole("button", { name: "Go to Prompts", exact: true }).click();
  await expect(page.getByLabel("Prompts per player", { exact: true })).toHaveValue("5");
  await expect(page.locator("#prompt-count-estimate")).toContainText("6 players × 5 prompts = 30 cards");
  await page.getByRole("button", { name: "Go to Mode", exact: true }).click();
  await page.getByRole("button", { name: /Pass & Play/ }).click();
  await page.getByRole("button", { name: "Go to Prompts", exact: true }).click();
  await page.getByRole("button", { name: /Write prompts/ }).click();
  await page.locator("#passPlayerCount").fill("6");
  await expect(page.locator("#passPromptCount")).toHaveValue("5");
  await page.locator("#passPlayerCount").fill("8");
  await expect(page.locator("#passPromptCount")).toHaveValue("5");
});

test("V1 keeps its original default and switching to V2 offers the group suggestion", async ({ page }) => {
  await createCustomGame(page);
  await selectVersion(page, "V1");
  await page.getByLabel("Expected players").fill("6");
  await page.getByRole("button", { name: "Go to Prompts", exact: true }).click();
  await expect(page.getByLabel("Prompts per player", { exact: true })).toHaveValue("3");
  await expect(page.locator("#prompt-count-estimate")).toHaveCount(0);
  await selectVersion(page, "V2");
  await expect(page.getByLabel("Prompts per player", { exact: true })).toHaveValue("7");
  await page.getByRole("button", { name: "Go to Mode", exact: true }).click();
  await page.getByLabel("Expected players").fill("");
  await page.getByRole("button", { name: "Go to Prompts", exact: true }).click();
  await expect(page.getByLabel("Prompts per player", { exact: true })).toHaveValue("3");
  await expect(page.locator("#prompt-count-estimate")).toContainText("Enter Expected players");
});

test("saved contributions survive a guest joining, refresh, and lobby editing", async ({ browser, page }) => {
  const id = await createCustomGame(page);
  await page.getByLabel("Expected players").fill("6");
  await page.getByRole("button", { name: "Go to Review", exact: true }).click();
  await expect(page.getByText("42 total · 7 each", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Create lobby", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Lobby", exact: true })).toBeVisible();
  expect((await loadSeededSnapshot(id)).game.prompts_per_player).toBe(7);
  const guestContext = await browser.newContext();
  await guestContext.addInitScript(() => localStorage.setItem("fish-bowl-ignore-analytics", "true"));
  const guest = await guestContext.newPage();
  try {
    await guest.goto(page.url());
    await guest.getByLabel("Your name", { exact: true }).fill("Prompt guest");
    await guest.getByRole("button", { name: "Join", exact: true }).click();
    await guest.getByRole("button", { name: "Continue", exact: true }).click();
    await expect(guest.getByText("Add your prompts. You have 7 left.", { exact: true })).toBeVisible();
    await expect(guest.getByLabel("Prompts per player", { exact: true })).toHaveCount(0);
    await guest.getByLabel("Prompts", { exact: true }).fill(Array.from({ length: 7 }, (_, i) => `Guest idea ${i + 1}`).join("\n"));
    await guest.getByRole("button", { name: "Submit 7 prompts", exact: true }).click();
    await expect(guest.getByText("You're ready. Waiting for the host to start.")).toBeVisible();
    await page.reload();
    await expect(page.getByRole("heading", { name: "Lobby", exact: true })).toBeVisible();
    expect((await loadSeededSnapshot(id)).game.prompts_per_player).toBe(7);
    await page.getByRole("button", { name: "Edit setup", exact: true }).click();
    await page.getByLabel("Expected players").fill("8");
    await page.getByRole("button", { name: "Go to Prompts", exact: true }).click();
    await expect(page.getByLabel("Prompts per player", { exact: true })).toHaveValue("7");
    await expect(page.locator("#prompt-count-estimate")).toContainText("8 players × 7 prompts = 56 cards");
    await page.getByRole("button", { name: "Cancel editing", exact: true }).click();
    const saved = await loadSeededSnapshot(id);
    expect(saved.game).toMatchObject({ prompts_per_player: 7, expected_players: 6 });
    expect(saved.prompts).toHaveLength(7);
  } finally { await guestContext.close(); }
});

test("a delayed version save preserves a manual contribution entered while saving", async ({ page }) => {
  await createCustomGame(page);
  await selectVersion(page, "V1");
  await page.getByLabel("Expected players").fill("6");
  await page.getByRole("button", { name: "Go to Prompts", exact: true }).click();
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  await page.route("**/api/mutation", async route => {
    if (route.request().postDataJSON()?.path === "game:setGameVersion") await gate;
    await route.continue();
  });
  try {
    await page.getByRole("button", { name: "Change game version", exact: true }).click();
    await page.getByRole("button", { name: /^V2 —/ }).click();
    await expect(page.getByRole("button", { name: /^V2 —/ })).toBeDisabled();
    await page.getByLabel("Prompts per player", { exact: true }).fill("5");
  } finally { release(); }
  await expect(page.getByLabel("Selected game version", { exact: true })).toContainText("V2");
  await expect(page.getByLabel("Prompts per player", { exact: true })).toHaveValue("5");
  await page.getByRole("button", { name: "Go to Mode", exact: true }).click();
  await page.getByLabel("Expected players").fill("4");
  await page.getByRole("button", { name: "Go to Prompts", exact: true }).click();
  await expect(page.getByLabel("Prompts per player", { exact: true })).toHaveValue("5");
});

test("Pass and Play estimates stay readable and save the suggested written bowl", async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  const id = await createCustomGame(page);
  await page.getByRole("button", { name: /Pass & Play/ }).click();
  await page.getByRole("button", { name: "Go to Prompts", exact: true }).click();
  await page.getByRole("button", { name: /Write prompts/ }).click();
  await expect(page.locator("#passPromptCount")).toHaveValue("10");
  await page.locator("#passPlayerCount").fill("2");
  await expect(page.locator("#passPromptCount")).toHaveValue("20");
  await page.locator("#passPlayerCount").fill("6");
  await expect(page.locator("#passPromptCount")).toHaveValue("7");
  await page.getByRole("button", { name: /Category prompts/ }).click();
  await expect(page.locator("#pass-prompt-count-estimate")).toContainText("6 players × 7 prompts = 42 cards");
  for (const width of [320, 390, 820, 1440]) {
    await page.setViewportSize({ width, height: width <= 390 ? 844 : 1080 });
    for (const size of [100, 200]) {
      await page.evaluate(percent => { document.documentElement.style.fontSize = `${percent}%`; }, size);
      await expect(page.locator("#pass-prompt-count-estimate")).toBeVisible();
      const issues = await page.locator("#pass-prompt-count-estimate").evaluate(element => {
        const container = element.closest(".field")!.getBoundingClientRect();
        const escaped = Array.from(element.querySelectorAll("p")).some(p => {
          const range = document.createRange(); range.selectNodeContents(p);
          return Array.from(range.getClientRects()).some(rect => rect.left < container.left - 1 || rect.right > container.right + 1);
        });
        return { escaped, overflow: document.documentElement.scrollWidth > innerWidth + 1 };
      });
      expect(issues, `${width}px at ${size}% text`).toEqual({ escaped: false, overflow: false });
      const overflowingLabels = await page.locator(".setup-wizard .category-toggle-grid button, .setup-wizard .segment").evaluateAll(buttons => buttons.filter(button => {
        const bounds = button.getBoundingClientRect();
        return Array.from(button.children).some(child => {
          const range = document.createRange(); range.selectNodeContents(child);
          return Array.from(range.getClientRects()).some(rect => rect.left < bounds.left - 1 || rect.right > bounds.right + 1);
        });
      }).map(button => button.textContent));
      expect(overflowingLabels).toEqual([]);
      if (size === 100 && width >= 820) {
        const playersBox = await page.locator("#passPlayerCount").boundingBox();
        const promptsBox = await page.locator("#passPromptCount").boundingBox();
        expect(Math.abs(playersBox!.y - promptsBox!.y)).toBeLessThan(2);
        expect(Math.abs(playersBox!.height - promptsBox!.height)).toBeLessThan(2);
      }
      if ((size === 100 && width !== 320) || (size === 200 && width === 320)) {
        await page.screenshot({ path: testInfo.outputPath(`prompt-count-${width}-${size}.png`), fullPage: true });
      }
    }
  }
  await page.evaluate(() => { document.documentElement.style.removeProperty("font-size"); });
  await page.getByRole("button", { name: /Write prompts/ }).click();
  await page.getByRole("button", { name: "Go to Review", exact: true }).click();
  await expect(page.getByText("42 total · 7 each", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Create lobby", exact: true }).click();
  await expect(page.getByText("Add prompts for the group. Shared prompts: 0 / 42.", { exact: true })).toBeVisible();
  await page.getByLabel("Prompts", { exact: true }).fill(Array.from({ length: 42 }, (_, i) => `Bowl idea ${i + 1}`).join("\n"));
  await page.getByRole("button", { name: "Submit 42 prompts", exact: true }).click();
  await expect(page.getByRole("button", { name: "Start game", exact: true })).toBeEnabled();
  const saved = await loadSeededSnapshot(id);
  expect(saved.game.prompts_per_player).toBe(7);
  expect(saved.prompts).toHaveLength(42);
  await page.getByRole("button", { name: "Start game", exact: true }).click();
  await expect(page.getByRole("button", { name: "Ready!", exact: true })).toBeVisible();
  const sessionToken = await page.evaluate(gameId => localStorage.getItem(`fish-bowl:${gameId}:session`), id);
  if (!sessionToken) throw new Error("Missing test host session");
  const convex = createE2EConvexClient();
  for (const freshCards of [false, true]) {
    await convex.mutation(api.game.finishGame, matchArgs(await loadSeededSnapshot(id), sessionToken));
    await convex.mutation(api.game.resetToLobby, { ...matchArgs(await loadSeededSnapshot(id), sessionToken), freshCards });
    const rematch = await loadSeededSnapshot(id);
    expect(rematch.game).toMatchObject({ phase: "lobby", prompts_per_player: 7 });
    expect(rematch.prompts).toHaveLength(freshCards ? 0 : 42);
    if (!freshCards) {
      await page.getByRole("button", { name: "Start game", exact: true }).click();
      await expect(page.getByRole("button", { name: "Ready!", exact: true })).toBeVisible();
    }
  }
  await page.reload();
  await expect(page.getByText("Add prompts for the group. Shared prompts: 0 / 42.", { exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});
