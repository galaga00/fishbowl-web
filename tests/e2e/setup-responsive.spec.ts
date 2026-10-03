import { expect, test, type Page } from "@playwright/test";
import { deleteTestGames } from "./helpers/convex-cleanup";

const gameIds: string[] = [];

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("fish-bowl-ignore-analytics", "true"));
});

test.afterEach(async () => {
  await deleteTestGames(gameIds);
  gameIds.length = 0;
});

async function expectReadablePresets(page: Page) {
  await expect(page.locator(".quick-presets button")).toHaveCount(3);
  const problems = await page.locator(".quick-presets button").evaluateAll((buttons) => {
    const issues: string[] = [];
    for (const button of buttons) {
      const bounds = button.getBoundingClientRect();
      const name = button.querySelector("strong")!.textContent;
      if (bounds.height < 44) issues.push(`${name}: touch target too short`);
      const children = Array.from(button.children);
      for (const child of children) {
        const range = document.createRange();
        range.selectNodeContents(child);
        for (const rect of range.getClientRects()) {
          if (rect.left < bounds.left - 1 || rect.right > bounds.right + 1 || rect.top < bounds.top - 1 || rect.bottom > bounds.bottom + 1) {
            issues.push(`${name}: "${child.textContent}" escapes its button`);
          }
        }
      }
      for (let index = 1; index < children.length; index += 1) {
        const previous = children[index - 1].getBoundingClientRect();
        const current = children[index].getBoundingClientRect();
        if (Math.min(previous.right, current.right) - Math.max(previous.left, current.left) > 1 && Math.min(previous.bottom, current.bottom) - Math.max(previous.top, current.top) > 1) {
          issues.push(`${name}: neighboring labels overlap`);
        }
      }
    }
    if (document.documentElement.scrollWidth > window.innerWidth + 1) issues.push("Page overflows horizontally");
    return issues;
  });
  expect(problems).toEqual([]);
}

test("setup presets stay readable across phone widths, larger text, and desktop", async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "Create Game", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Quick start", exact: true })).toBeVisible();
  gameIds.push(page.url().split("/game/")[1]);

  for (const width of [320, 360, 375, 390, 393, 430, 559, 560, 679, 680, 768, 820, 900, 1024, 1440]) {
    await test.step(`${width}px`, async () => {
      await page.setViewportSize({ width, height: width <= 430 ? 844 : 1080 });
      await expectReadablePresets(page);
      if ([390, 820, 1440].includes(width)) {
        await page.screenshot({ path: testInfo.outputPath(`setup-${width}.png`), fullPage: true });
      }
    });
  }

  await page.setViewportSize({ width: 393, height: 760 });
  for (const size of [125, 150, 200]) {
    await page.evaluate((percent) => { document.documentElement.style.fontSize = `${percent}%`; }, size);
    await expectReadablePresets(page);
  }
  await page.screenshot({ path: testInfo.outputPath("setup-large-text.png"), fullPage: true });
  await page.evaluate(() => { document.documentElement.style.removeProperty("font-size"); });

  for (const title of ["Family", "Quick", "Classic"]) {
    const option = page.getByRole("button", { name: new RegExp(`^${title} `) });
    await option.click();
    await expect(option).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator('.quick-presets [aria-pressed="true"]')).toHaveCount(1);
  }
  await page.getByRole("button", { name: /Pass & Play/ }).click();
  for (const title of ["Prompts", "Teams", "Review"]) {
    await page.getByRole("button", { name: "Next", exact: true }).click();
    await expect(page.getByRole("heading", { name: title, exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
  }
  await expect(page.getByRole("button", { name: "Create lobby", exact: true })).toBeEnabled();
  expect(errors).toEqual([]);
});
