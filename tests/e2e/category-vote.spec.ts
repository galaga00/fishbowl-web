import { expect, test, type Page } from "@playwright/test";
import { api } from "../../convex/_generated/api";
import { createE2EConvexClient, deleteTestGames } from "./helpers/convex-cleanup";
import { loadSeededSnapshot } from "./helpers/seed-game";
import type { Id } from "../../convex/_generated/dataModel";

const ids: string[] = [];
test.beforeEach(async ({ context }) => { await context.addInitScript(() => localStorage.setItem("fish-bowl-ignore-analytics", "true")); });
test.afterEach(async () => { await deleteTestGames(ids); ids.length = 0; });
async function create(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "Create Game", exact: true }).click();
  await expect(page.getByRole("button", { name: "Custom game", exact: true })).toBeVisible();
  const id = page.url().split("/game/")[1]; ids.push(id);
  await page.getByRole("button", { name: "Custom game", exact: true }).click();
  return id;
}
async function version(page: Page, value: string) {
  await page.getByRole("button", { name: "Change game version" }).click();
  await page.getByRole("button", { name: new RegExp(`^${value} —`) }).click();
  await expect(page.getByLabel("Selected game version")).toContainText(value);
}
async function checkLayout(page: Page) {
  const layout = await page.evaluate(() => ({
    width: innerWidth, textSize: document.documentElement.style.fontSize,
    overflow: document.documentElement.scrollWidth > innerWidth + 1,
    escaped: Array.from(document.querySelectorAll("main *")).filter(el => el.getBoundingClientRect().right > innerWidth + 1).slice(0, 8).map(el => ({ tag: el.tagName, class: el.className, right: el.getBoundingClientRect().right }))
  }));
  expect(layout.overflow, JSON.stringify(layout)).toBe(false);
  const escaped = await page.locator(".category-ballot button, .setup-wizard .segment").evaluateAll(buttons => buttons.filter(button => {
    const bounds = button.getBoundingClientRect();
    return Array.from(button.children).some(child => {
      const range = document.createRange(); range.selectNodeContents(child);
      return Array.from(range.getClientRects()).some(rect => rect.left < bounds.left - 1 || rect.right > bounds.right + 1);
    });
  }).map(button => button.textContent));
  expect(escaped).toEqual([]);
}

test("voting setup survives path/version changes and works at phone widths and enlarged text", async ({ page }, info) => {
  const id = await create(page);
  await page.getByRole("button", { name: /Pass & Play/ }).click();
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await page.getByRole("button", { name: "Use category voting", exact: true }).click();
  await expect(page.getByLabel("Cards in the bowl", { exact: true })).toHaveValue("40");
  await page.getByLabel("Cards in the bowl", { exact: true }).fill("36");
  await page.getByLabel("Categories in the bowl", { exact: true }).fill("2");
  await page.getByLabel("Categories in the bowl", { exact: true }).press("Tab");
  await page.getByRole("button", { name: "Quick game", exact: true }).click();
  await expect(page.getByLabel("Cards in the bowl", { exact: true })).toBeHidden();
  await page.getByRole("button", { name: "Custom game", exact: true }).click();
  await version(page, "V1");
  await expect(page.getByRole("button", { name: /^Category vote/ })).toHaveCount(0);
  await version(page, "V2");
  await expect(page.getByLabel("Cards in the bowl", { exact: true })).toHaveValue("36");
  await expect(page.getByLabel("Categories in the bowl", { exact: true })).toHaveValue("2");
  for (const width of [320, 390, 820, 1440]) for (const size of [100, 200]) {
    await page.setViewportSize({ width, height: 900 });
    await page.evaluate(size => { document.documentElement.style.fontSize = `${size}%`; }, size);
    await checkLayout(page);
    if ((width === 390 && size === 100) || (width === 320 && size === 200)) await page.screenshot({ path: info.outputPath(`vote-setup-${width}-${size}.png`), fullPage: true });
  }
  await page.evaluate(() => { document.documentElement.style.removeProperty("font-size"); });
  await page.getByRole("button", { name: "Go to Review", exact: true }).click();
  await expect(page.getByText("Category vote · 2 categories", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Create lobby", exact: true }).click();
  await expect(page.getByRole("button", { name: "Start category vote", exact: true })).toBeDisabled();
  await page.reload();
  await page.getByRole("button", { name: "Edit setup", exact: true }).click();
  await page.getByRole("button", { name: "Go to Prompts", exact: true }).click();
  await expect(page.getByLabel("Cards in the bowl", { exact: true })).toHaveValue("36");
  await expect(page.getByLabel("Categories in the bowl", { exact: true })).toHaveValue("2");
  expect((await loadSeededSnapshot(id)).game).toMatchObject({ deck_selection: "vote", vote_card_count: 36, vote_category_count: 2 });
});

test("three phones join by link/code, vote privately, recover failed submissions and reveal only gameplay cards", async ({ page, browser }, info) => {
  const errors: string[] = []; page.on("pageerror", error => errors.push(error.message));
  const id = await create(page);
  await page.locator("#expectedPlayers").fill("4");
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await page.getByRole("button", { name: /^Category vote/ }).click();
  await page.getByLabel("Categories in the bowl", { exact: true }).fill("2");
  await page.getByRole("button", { name: "Go to Review", exact: true }).click();
  await page.getByRole("button", { name: "Create lobby", exact: true }).click();
  const room = await loadSeededSnapshot(id);
  const contexts = await Promise.all([browser.newContext({ viewport: { width: 390, height: 844 } }), browser.newContext({ viewport: { width: 390, height: 844 } })]);
  try {
    for (const context of contexts) await context.addInitScript(() => localStorage.setItem("fish-bowl-ignore-analytics", "true"));
    const [guest, codeGuest] = await Promise.all(contexts.map(context => context.newPage()));
    await guest.goto(page.url());
    await guest.getByLabel("Your name", { exact: true }).fill("Link guest");
    await guest.getByRole("button", { name: "Join", exact: true }).click();
    await expect(guest.getByRole("heading", { name: "Vote for the bowl" })).toBeVisible();
    await codeGuest.goto(new URL("/", page.url()).toString());
    await codeGuest.getByRole("button", { name: "Join Game", exact: true }).click();
    await codeGuest.locator("#joinName").fill("Code guest");
    await codeGuest.locator("#joinCode").fill(room.game.code);
    await codeGuest.getByRole("button", { name: "Join Game", exact: true }).click();
    await expect(codeGuest.getByRole("heading", { name: "Vote for the bowl" })).toBeVisible();
    await expect(guest.getByRole("button", { name: "Start category vote", exact: true })).toHaveCount(0);
    await expect(guest.getByRole("button", { name: "Edit setup", exact: true })).toHaveCount(0);
    await page.getByRole("button", { name: "Start category vote", exact: true }).click();
    await expect(page.getByRole("alertdialog", { name: "Start voting with fewer players?" })).toContainText("3 of 4");
    await page.getByRole("button", { name: "Start with these players", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Category vote 1 of 2", exact: true })).toBeVisible();
    await expect(page.getByAltText("QR code for joining this game")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Edit setup", exact: true })).toBeDisabled();
    await page.route("**/api/mutation", async route => {
      if (route.request().postDataJSON()?.path !== "game:castCategoryVote") return route.continue();
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ status: "error", errorMessage: "Could not save your vote. Try again." }) });
    });
    await page.getByRole("group", { name: "Category ballot 1" }).getByRole("button").first().click();
    await expect(page.getByRole("alert").filter({ hasText: "Could not save your vote" })).toBeVisible();
    await page.unroute("**/api/mutation");
    for (let round = 1; round <= 2; round++) {
      const ballot = page.getByRole("group", { name: `Category ballot ${round}`, exact: true });
      await expect(ballot).toBeVisible();
      const labels = await ballot.locator("strong").allTextContents();
      for (const other of [guest, codeGuest]) {
        await expect(other.getByRole("group", { name: `Category ballot ${round}`, exact: true })).toBeVisible();
        expect(await other.getByRole("group", { name: `Category ballot ${round}`, exact: true }).locator("strong").allTextContents()).toEqual(labels);
      }
      if (round === 1) {
        for (const width of [320, 390, 820, 1440]) for (const size of [100, 200]) {
          await page.setViewportSize({ width, height: 900 });
          await page.evaluate(size => { document.documentElement.style.fontSize = `${size}%`; }, size);
          await checkLayout(page);
          if ((width === 390 && size === 100) || (width === 320 && size === 200)) await page.screenshot({ path: info.outputPath(`vote-ballot-${width}-${size}.png`), fullPage: true });
        }
        await page.evaluate(() => { document.documentElement.style.removeProperty("font-size"); });
      }
      await ballot.getByRole("button").first().focus();
      await page.keyboard.press("Enter");
      await expect(ballot.getByRole("button").first()).toHaveAttribute("aria-pressed", "true");
      await page.reload();
      await expect(page.getByRole("group", { name: `Category ballot ${round}`, exact: true }).getByRole("button").first()).toHaveAttribute("aria-pressed", "true");
      await expect(guest.getByRole("group", { name: `Category ballot ${round}`, exact: true }).locator('[aria-pressed="true"]')).toHaveCount(0);
      await guest.getByRole("group", { name: `Category ballot ${round}`, exact: true }).getByRole("button").nth(1).click();
      // An absent voter must not stall game night; the host closes this round inline.
      await page.getByText("Someone can’t vote?", { exact: true }).click();
      await page.getByRole("button", { name: "Close voting round", exact: true }).click();
      await page.getByRole("button", { name: "Count these votes", exact: true }).click();
    }
    for (const viewer of [page, guest, codeGuest]) await expect(viewer.getByRole("heading", { name: "Your secret bowl is ready", exact: true })).toBeVisible();
    const sessionToken = await page.evaluate(id => localStorage.getItem(`fish-bowl:${id}:session`)!, id);
    const publicRoom = await createE2EConvexClient().query(api.game.loadSnapshot, { gameId: id as Id<"games">, sessionToken });
    expect(publicRoom!.prompts).toHaveLength(40);
    expect(publicRoom!.prompts.every(p => !p.text && !p.category)).toBe(true);
    expect(publicRoom!.categoryVote!.choices).toEqual([]);
    await page.getByRole("button", { name: "Start game", exact: true }).click();
    await expect.poll(async () => (await loadSeededSnapshot(id)).game.phase).toBe("ready");
    expect(errors).toEqual([]);
  } finally { for (const context of contexts) await context.close(); }
});
