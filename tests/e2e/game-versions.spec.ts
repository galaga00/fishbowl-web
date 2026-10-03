import { randomBytes } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import { api } from "../../convex/_generated/api";
import type { GameVersion } from "../../lib/game-versions";
import { createE2EConvexClient, deleteTestGames } from "./helpers/convex-cleanup";
import { matchArgs, setupArgs } from "./helpers/game-args";
import { loadSeededSnapshot, seedReadyPassAndPlayGame } from "./helpers/seed-game";

const ids: string[] = [];
const token = () => randomBytes(32).toString("hex");
test.beforeEach(async ({ context }) => {
  await context.addInitScript(() => localStorage.setItem("fish-bowl-ignore-analytics", "true"));
});
test.afterEach(async () => { await deleteTestGames(ids); ids.length = 0; });

async function createRoom(version: GameVersion = "v2") {
  const convex = createE2EConvexClient();
  const sessionToken = token();
  const room = await convex.mutation(api.game.createGame, { hostName: "Host", sessionToken });
  ids.push(room.game.id);
  if (version !== "v2") await convex.mutation(api.game.setGameVersion, { gameId: room.game.id, sessionToken, gameVersion: version });
  return { ...room, sessionToken, convex };
}

async function createInBrowser(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "Create Game", exact: true }).click();
  await expect(page.getByRole("region", { name: "Game version", exact: true })).toBeVisible();
  const gameId = page.url().split("/game/")[1];
  ids.push(gameId);
  return gameId;
}

async function chooseVersion(page: Page, version: GameVersion) {
  await page.getByRole("button", { name: "Change game version", exact: true }).click();
  await page.getByRole("button", { name: new RegExp(`^${version.toUpperCase()} —`) }).click();
  await expect(page.getByLabel("Selected game version", { exact: true })).toContainText(version.toUpperCase());
}

test("version selection is authorized, validated, and locked after setup", async () => {
  const { game, sessionToken, convex } = await createRoom();
  expect(game.game_version).toBe("v2");
  const args = { gameId: game.id, sessionToken, gameVersion: "v1" as const };
  await expect(convex.mutation(api.game.setGameVersion, { ...args, sessionToken: token() })).rejects.toThrow("session");
  const other = await createRoom();
  await expect(convex.mutation(api.game.setGameVersion, { ...args, sessionToken: other.sessionToken })).rejects.toThrow("session");
  // Exercise runtime validation with a value a typed client cannot send.
  await expect(convex.mutation(api.game.setGameVersion, { ...args, gameVersion: "v3" as GameVersion })).rejects.toThrow();
  await convex.mutation(api.game.setGameVersion, args);
  await convex.mutation(api.game.setGameVersion, args);
  const snapshot = await loadSeededSnapshot(game.id);
  expect(snapshot.game).toMatchObject({ id: game.id, code: game.code, game_version: "v1", access_version: 2, phase: "setup" });
  expect(snapshot.players).toHaveLength(1);
  await convex.mutation(api.game.saveGameSetup, { ...setupArgs(game.id, sessionToken), promptMode: "free" });
  const guestToken = token();
  const guest = await convex.mutation(api.game.joinGame, { code: game.code, playerName: "Guest", sessionToken: guestToken });
  await expect(convex.mutation(api.game.setGameVersion, { ...args, sessionToken: guestToken })).rejects.toThrow("host");
  await expect(convex.mutation(api.game.setGameVersion, args)).rejects.toThrow("locked");
  await convex.mutation(api.game.submitPrompts, { gameId: game.id, sessionToken, playerId: game.host_player_id!, prompts: ["Host card"] });
  await convex.mutation(api.game.submitPrompts, { gameId: game.id, sessionToken: guestToken, playerId: guest.player.id, prompts: ["Guest card"] });
  const ready = await loadSeededSnapshot(game.id);
  await convex.mutation(api.game.startGame, matchArgs(ready, sessionToken));
  await expect(convex.mutation(api.game.setGameVersion, args)).rejects.toThrow("locked");
  await convex.mutation(api.game.finishGame, matchArgs(await loadSeededSnapshot(game.id), sessionToken));
  await convex.mutation(api.game.resetToLobby, { ...matchArgs(await loadSeededSnapshot(game.id), sessionToken), freshCards: false });
  await expect(convex.mutation(api.game.setGameVersion, args)).rejects.toThrow("locked");
  expect((await loadSeededSnapshot(game.id)).game.game_version).toBe("v1");
});

test("rooms without a version resolve to V2 without a backfill", async () => {
  const seed = await seedReadyPassAndPlayGame({ promptCount: 3 });
  ids.push(seed.gameId);
  expect((await loadSeededSnapshot(seed.gameId)).game.game_version).toBeUndefined();
  const snapshot = await createE2EConvexClient().query(api.game.loadSnapshot, { gameId: seed.gameId, sessionToken: seed.sessionToken });
  expect(snapshot!.game.game_version).toBe("v2");
  expect(snapshot!.game.access_version).toBe(2);
});

test("host can compare versions without losing setup, recover a failed save, and resume V1", async ({ page }) => {
  const gameId = await createInBrowser(page);
  await page.getByRole("button", { name: "Quick game", exact: true }).click();
  await page.getByLabel("Number of players", { exact: true }).selectOption("6");
  await page.getByRole("button", { name: /^Family 30 cards/ }).click();
  await page.getByRole("button", { name: "Custom game", exact: true }).click();
  await page.getByRole("button", { name: /Pass & Play/ }).click();
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await page.locator("#passCardCount").fill("30");
  await chooseVersion(page, "v1");
  await expect(page.getByRole("group", { name: "Choose game setup" })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Quick start", exact: true })).toBeHidden();
  await expect(page.getByRole("heading", { name: "Prompts", exact: true })).toBeVisible();
  await expect(page.locator("#passCardCount")).toHaveValue("30");
  await chooseVersion(page, "v2");
  await expect(page.locator("#passCardCount")).toHaveValue("30");
  await expect(page.getByRole("heading", { name: "Prompts", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Quick game", exact: true }).click();
  await expect(page.getByLabel("Number of players", { exact: true })).toHaveValue("6");
  await expect(page.getByRole("button", { name: /^Family 30 cards/ })).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Custom game", exact: true }).click();

  await page.route("**/api/mutation", async route => {
    if (route.request().postDataJSON()?.path !== "game:setGameVersion") return route.continue();
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ status: "error", errorMessage: "Unable to save the version. Try again." }) });
  });
  await page.getByRole("button", { name: "Change game version" }).click();
  await page.getByRole("button", { name: /^V1 —/ }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Unable to save the version" })).toBeVisible();
  await expect(page.getByLabel("Selected game version")).toHaveText("V2 — Improved");
  await expect(page.locator("#passCardCount")).toHaveValue("30");
  await page.unroute("**/api/mutation");
  await page.getByRole("button", { name: /^V1 —/ }).click();
  await expect(page.getByLabel("Selected game version")).toHaveText("V1 — Original");
  expect(page.url()).toContain(`/game/${gameId}`);
  await page.reload();
  await expect(page.getByLabel("Selected game version")).toHaveText("V1 — Original");
  await page.getByRole("link", { name: "Home", exact: true }).click();
  await page.getByRole("link", { name: "Continue my game" }).click();
  await expect(page.getByLabel("Selected game version")).toHaveText("V1 — Original");
  await createInBrowser(page);
  await expect(page.getByLabel("Selected game version")).toHaveText("V2 — Improved");
});

for (const version of ["v1", "v2"] as const) {
  test(`${version} guests join by link and code with no version controls`, async ({ browser, page }) => {
    const { game, convex, sessionToken } = await createRoom(version);
    await page.addInitScript(({ id, token }) => localStorage.setItem(`fish-bowl:${id}:session`, token), { id: game.id, token: sessionToken });
    await page.goto(`/game/${game.id}`);
    await expect(page.getByRole("region", { name: "Game version", exact: true })).toBeVisible();
    const guestContext = await browser.newContext();
    await guestContext.addInitScript(() => localStorage.setItem("fish-bowl-ignore-analytics", "true"));
    const guest = await guestContext.newPage();
    try {
      await guest.goto(page.url());
      await expect(guest.getByRole("heading", { name: "Waiting for the host" })).toBeVisible();
      await expect(guest.getByRole("region", { name: "Game version", exact: true })).toHaveCount(0);
      await expect(guest.getByRole("group", { name: "Choose game setup" })).toHaveCount(0);
      await expect(guest.getByRole("button", { name: "Start quick game" })).toHaveCount(0);
      await convex.mutation(api.game.saveGameSetup, { ...setupArgs(game.id, sessionToken), promptMode: "free" });
      await expect(page.getByRole("button", { name: "Change game version" })).toHaveCount(0);
      await expect(page.getByRole("button", { name: "Edit setup" })).toHaveCount(version === "v2" ? 1 : 0);
      const invite = await page.locator("a.input.tiny").getAttribute("href");
      expect(invite).toBe(page.url());
      await guest.goto(invite!);
      await guest.getByLabel("Your name", { exact: true }).fill("Link guest");
      await guest.getByRole("button", { name: "Join", exact: true }).click();
      await expect(guest.getByRole("heading", { name: "Team selected", exact: true })).toBeVisible();
      await expect(guest.locator(`main.game-${version}`)).toBeVisible();
      await expect(guest.getByLabel("Selected game version")).toHaveCount(0);
      await guest.reload();
      await expect(guest.getByRole("heading", { name: "Team selected", exact: true })).toBeVisible();
      await expect(page.getByText("Link guest", { exact: true })).toBeVisible();
      await expect(guest.getByRole("button", { name: "Change game version" })).toHaveCount(0);
      await guestContext.clearCookies();
      await guest.evaluate(() => localStorage.clear());
      await guest.goto(new URL("/", invite!).toString());
      await guest.getByRole("button", { name: "Join Game", exact: true }).click();
      await guest.locator("#joinName").fill("Code guest");
      await guest.locator("#joinCode").fill(game.code);
      await guest.getByRole("button", { name: "Join Game", exact: true }).click();
      await expect(guest.getByRole("heading", { name: "Team selected", exact: true })).toBeVisible();
      await expect(guest.locator(`main.game-${version}`)).toBeVisible();
      await expect(page.getByText("Code guest", { exact: true })).toBeVisible();
      expect((await loadSeededSnapshot(game.id)).game.game_version).toBe(version);
    } finally { await guestContext.close(); }
  });
}

test("V1 completes three rounds with original controls and retains its version for a rematch", async ({ page }) => {
  test.setTimeout(300_000);
  const gameId = await createInBrowser(page);
  await chooseVersion(page, "v1");
  await page.getByRole("button", { name: /Pass & Play/ }).click();
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await page.locator("#passCardCount").fill("10");
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await page.getByRole("button", { name: "Create lobby", exact: true }).click();
  await page.getByRole("button", { name: "Start game", exact: true }).click();
  await expect(page.getByRole("button", { name: "Ready!", exact: true })).toBeVisible();
  await expect(page.getByText("More host controls", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "End game", exact: true })).toBeVisible();
  await expect(page.getByLabel("Turn progress")).toHaveCount(0);
  const original = await loadSeededSnapshot(gameId);
  const progressKey = (snapshot: typeof original) => `${snapshot.game.phase}:${snapshot.game.round_number}:${snapshot.game.current_prompt_id}:${snapshot.activeTurn?.id}`;
  let current = original;
  for (let count = 0; count < 110 && current.game.phase !== "finished"; count += 1) {
    const previous = progressKey(current);
    const action = page.getByRole("button", { name: /^(Ready!|Correct)$/ });
    await expect(action).toBeEnabled();
    await action.click();
    await expect.poll(async () => { current = await loadSeededSnapshot(gameId); return progressKey(current); }).not.toBe(previous);
  }
  await expect(page.getByRole("heading", { name: "Game finished", exact: true })).toBeVisible();
  expect(current.teams.reduce((total, team) => total + team.score, 0)).toBe(30);
  expect(current.game).toMatchObject({ game_version: "v1", finish_reason: "completed" });
  await expect(page.getByRole("button", { name: /Play again/ })).toHaveCount(0);
  await page.getByRole("button", { name: "Reset to lobby", exact: true }).click();
  await page.getByRole("button", { name: "Reset scores", exact: true }).click();
  await expect(page.getByRole("button", { name: "Start game", exact: true })).toBeEnabled();
  const rematch = await loadSeededSnapshot(gameId);
  expect(rematch.game.game_version).toBe("v1");
  expect(rematch.prompts.map(p => p.text).sort()).toEqual(original.prompts.map(p => p.text).sort());
  await expect(page.getByRole("button", { name: "Change game version" })).toHaveCount(0);
});

test("version choices and both setup layouts fit phones, enlarged text, tablets, and desktop", async ({ page }, testInfo) => {
  await createInBrowser(page);
  for (const version of ["v1", "v2"] as const) {
    await chooseVersion(page, version);
    if (version === "v2") await page.getByRole("button", { name: "Custom game", exact: true }).click();
    await page.getByRole("button", { name: "Change game version" }).click();
    for (const width of [320, 390, 680, 820, 1440]) {
      await page.setViewportSize({ width, height: width < 680 ? 844 : 1080 });
      for (const fontSize of [100, 200]) {
        await page.evaluate(size => {
          document.documentElement.style.fontSize = `${size}%`;
          // Exercise a wide display without changing the actual room's join code.
          document.querySelector(".code")!.textContent = "WWWWW";
        }, fontSize);
        const problems = await page.locator(".version-choice").evaluateAll(buttons => {
          const issues: string[] = [];
          for (const button of buttons) {
            const bounds = button.getBoundingClientRect();
            if (bounds.height < 44) issues.push("Short touch target");
            for (const child of button.children) {
              const range = document.createRange(); range.selectNodeContents(child);
              for (const r of range.getClientRects()) if (r.left < bounds.left - 1 || r.right > bounds.right + 1 || r.bottom > bounds.bottom + 1) issues.push("Text escapes choice");
            }
          }
          if (document.documentElement.scrollWidth > innerWidth + 1) issues.push("Page overflow");
          return issues;
        });
        expect(problems, `${version} at ${width}px and ${fontSize}% text`).toEqual([]);
        if (fontSize === 100 && [390, 820, 1440].includes(width)) await page.screenshot({ path: testInfo.outputPath(`${version}-setup-${width}.png`), fullPage: true });
      }
    }
    await page.evaluate(() => document.documentElement.style.removeProperty("font-size"));
    await page.getByRole("button", { name: "Close version choices" }).click();
  }
});
