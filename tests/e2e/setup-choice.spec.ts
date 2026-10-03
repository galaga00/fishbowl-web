import { expect, test, type Page } from "@playwright/test";
import { deleteTestGames } from "./helpers/convex-cleanup";
import { loadSeededSnapshot } from "./helpers/seed-game";

const ids: string[] = [];
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("fish-bowl-ignore-analytics", "true"));
});
test.afterEach(async () => { await deleteTestGames(ids); ids.length = 0; });

async function createRoom(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "Create Game", exact: true }).click();
  await expect(page.getByRole("group", { name: "Choose game setup" })).toBeVisible();
  const id = page.url().split("/game/")[1];
  ids.push(id);
  return id;
}

test("host explicitly chooses a path, switches without losing drafts, and refresh resets the choice", async ({ page, isMobile }) => {
  const id = await createRoom(page);
  const quick = page.getByRole("button", { name: "Quick game", exact: true });
  const custom = page.getByRole("button", { name: "Custom game", exact: true });
  await expect(quick).toHaveAttribute("aria-pressed", "false");
  await expect(custom).toHaveAttribute("aria-pressed", "false");
  await expect(page.locator("#quick-setup")).toBeHidden();
  await expect(page.locator("#custom-setup")).toBeHidden();
  if (isMobile) await quick.tap();
  else {
    await quick.focus();
    await page.keyboard.press("Enter");
  }
  await page.getByLabel("Number of players", { exact: true }).selectOption("6");
  await page.getByRole("button", { name: /^Family 30 cards/ }).click();

  if (isMobile) await custom.tap();
  else {
    await quick.focus();
    await page.keyboard.press("Tab");
    await expect(custom).toBeFocused();
    await page.keyboard.press("Space");
  }
  await expect(page.locator("#quick-setup")).toBeHidden();
  // Desktop keyboard navigation skips the hidden form. Phone coverage uses taps,
  // since mobile WebKit's default Tab navigation does not include these buttons.
  if (!isMobile) {
    await page.keyboard.press("Tab");
    await expect(page.getByRole("button", { name: "Go to Mode", exact: true })).toBeFocused();
  }
  await page.getByLabel("Expected players").fill("6");
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await page.getByLabel("Prompts per player", { exact: true }).fill("7");
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await page.getByLabel("Team 1", { exact: true }).fill("The Otters");
  await quick.click();
  await expect(page.locator("#custom-setup")).toBeHidden();
  await expect(page.getByLabel("Number of players", { exact: true })).toHaveValue("6");
  await expect(page.getByRole("button", { name: /^Family 30 cards/ })).toHaveAttribute("aria-pressed", "true");
  await custom.click();
  await expect(page.getByRole("heading", { name: "Teams", exact: true })).toBeVisible();
  await expect(page.getByLabel("Team 1", { exact: true })).toHaveValue("The Otters");
  await page.getByRole("button", { name: "Go to Prompts", exact: true }).click();
  await expect(page.getByLabel("Prompts per player", { exact: true })).toHaveValue("7");
  await page.getByRole("button", { name: "Go to Mode", exact: true }).click();
  await expect(page.getByLabel("Expected players")).toHaveValue("6");
  expect((await loadSeededSnapshot(id)).game.phase).toBe("setup");
  await page.reload();
  await expect(page.getByRole("group", { name: "Choose game setup" })).toBeVisible();
  await expect(quick).toHaveAttribute("aria-pressed", "false");
  await expect(custom).toHaveAttribute("aria-pressed", "false");
  await expect(page.locator("#quick-setup")).toBeHidden();
  await expect(page.locator("#custom-setup")).toBeHidden();
});

for (const path of ["Quick game", "Custom game"]) {
  test(`${path} locks switching during save and preserves the path after an inline failure`, async ({ page }) => {
    const id = await createRoom(page);
    await page.getByRole("button", { name: path, exact: true }).click();
    if (path === "Custom game") {
      await page.getByRole("button", { name: "Go to Review", exact: true }).click();
    }
    let release!: () => void;
    const gate = new Promise<void>(resolve => { release = resolve; });
    await page.route("**/api/mutation", async route => {
      if (route.request().postDataJSON()?.path !== "game:saveGameSetup") return route.continue();
      await gate;
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ status: "error", errorMessage: "Could not save setup. Please retry." }) });
    });
    const start = page.getByRole("button", { name: path === "Quick game" ? "Start quick game" : "Create lobby", exact: true });
    try {
      await start.click();
      await expect(page.getByRole("button", { name: "Quick game", exact: true })).toBeDisabled();
      await expect(page.getByRole("button", { name: "Custom game", exact: true })).toBeDisabled();
      await expect(page.getByRole("button", { name: "Change game version", exact: true })).toBeDisabled();
    } finally { release(); }
    await expect(page.getByRole("alert").filter({ hasText: "Could not save setup" })).toBeVisible();
    await expect(page.getByRole("button", { name: path, exact: true })).toHaveAttribute("aria-pressed", "true");
    expect((await loadSeededSnapshot(id)).game.phase).toBe("setup");
    await page.unroute("**/api/mutation");
    await start.click();
    if (path === "Quick game") await expect(page.getByRole("button", { name: "Ready!", exact: true })).toBeVisible();
    else await expect(page.getByRole("heading", { name: "Lobby", exact: true })).toBeVisible();
    await expect(page.getByRole("group", { name: "Choose game setup" })).toHaveCount(0);
  });
}

for (const mode of ["free", "category"] as const) {
  test(`custom Pass & Play accepts player-written ${mode} prompts and starts with their bowl`, async ({ page }) => {
    const id = await createRoom(page);
    await page.getByRole("button", { name: "Custom game", exact: true }).click();
    await page.getByRole("button", { name: /Pass & Play/ }).click();
    await page.getByRole("button", { name: "Next", exact: true }).click();
    await page.getByRole("button", { name: mode === "free" ? /Write prompts/ : /Category prompts/ }).click();
    await page.locator("#passPlayerCount").fill("2");
    await page.locator("#passPromptCount").fill("1");
    await page.getByRole("button", { name: "Go to Review", exact: true }).click();
    await page.getByRole("button", { name: "Create lobby", exact: true }).click();
    const prompts = ["A dancing otter", "A very tiny spaceship"];
    if (mode === "free") await page.getByLabel("Prompts", { exact: true }).fill(prompts.join("\n"));
    else {
      await page.locator("#category-prompt-0").fill(prompts[0]);
      await page.locator("#category-prompt-1").fill(prompts[1]);
    }
    await page.getByRole("button", { name: "Submit 2 prompts", exact: true }).click();
    await expect(page.getByRole("button", { name: "Start game", exact: true })).toBeEnabled();
    await page.getByRole("button", { name: "Start game", exact: true }).click();
    await expect(page.getByRole("button", { name: "Ready!", exact: true })).toBeVisible();
    const saved = await loadSeededSnapshot(id);
    expect(saved.game.prompt_mode).toBe(mode);
    expect(saved.prompts.map(prompt => prompt.text).sort()).toEqual(prompts.sort());
  });
}

test("both choices and paths fit narrow phones, enlarged text, tablets, and desktop", async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await createRoom(page);
  // Stress the variable-width join code as well as the new chooser's labels.
  await page.locator(".code").evaluate(element => { element.textContent = "WWWWW"; });
  for (const width of [320, 375, 390, 430, 679, 680, 820, 1440]) {
    await page.setViewportSize({ width, height: width < 680 ? 844 : 1080 });
    for (const size of [100, 200]) {
      await page.evaluate(value => { document.documentElement.style.fontSize = `${value}%`; }, size);
      const issues = await page.locator(".setup-option").evaluateAll(buttons => {
        const problems: string[] = [];
        for (const button of buttons) {
          const bounds = button.getBoundingClientRect();
          if (bounds.height < 44) problems.push("Short touch target");
          for (const child of button.children) {
            const range = document.createRange(); range.selectNodeContents(child);
            for (const rect of range.getClientRects()) {
              if (rect.left < bounds.left - 1 || rect.right > bounds.right + 1 || rect.bottom > bounds.bottom + 1) problems.push("Text escapes choice");
            }
          }
        }
        if (document.documentElement.scrollWidth > innerWidth + 1) problems.push("Page overflow");
        return problems;
      });
      expect(issues).toEqual([]);
      if (size === 100 && [390, 820, 1440].includes(width)) await page.screenshot({ path: testInfo.outputPath(`chooser-${width}.png`), fullPage: true });
    }
  }
  await page.setViewportSize({ width: 320, height: 844 });
  for (const path of ["Quick game", "Custom game"]) {
    await page.getByRole("button", { name: path, exact: true }).click();
    if (path === "Custom game") {
      for (const step of ["Mode", "Prompts", "Teams", "Review"]) {
        await page.getByRole("button", { name: `Go to ${step}`, exact: true }).click();
        await expect(page.getByRole("heading", { name: step, exact: true })).toBeVisible();
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
      }
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath(`${path.split(" ")[0].toLowerCase()}-320-large-text.png`), fullPage: true });
  }
  expect(errors).toEqual([]);
});
