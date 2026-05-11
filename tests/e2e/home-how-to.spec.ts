import { expect, test } from "@playwright/test";

test.describe("Home how-to artwork", () => {
  test("preloads how-to art and swaps away from home fishbowl layers", async ({ page }) => {
    await page.goto("/");

    await expect(page.locator('link[rel="preload"][as="image"][href*="/assets/art/how-to/"]')).toHaveCount(6);

    await page.getByRole("button", { name: "How to Play" }).click();
    await expect(page.getByRole("heading", { name: "Choose teams or let Fish Bowl pick!" })).toBeVisible();
    await expect(page.locator(".home-art-layer")).toHaveCount(0);
    await expect(page.locator(".how-to-art")).toBeVisible();

    await page.locator(".how-to-art").evaluate((image) => {
      const htmlImage = image as HTMLImageElement;
      return htmlImage.decode ? htmlImage.decode().catch(() => undefined) : undefined;
    });

    await expect(page.locator(".how-to-art")).toHaveJSProperty("complete", true);
    const naturalWidth = await page.locator(".how-to-art").evaluate((image) => (image as HTMLImageElement).naturalWidth);
    expect(naturalWidth).toBeGreaterThan(0);
    await expect(page.locator(".how-to-art")).toHaveAttribute("src", /step-0\.png/);
    await expect(page.locator(".how-to-art")).not.toHaveAttribute("src", /_next\/image/);

    await page.getByRole("button", { name: "Next", exact: true }).click();
    await expect(page.locator(".how-to-art")).toHaveAttribute("src", /step-1\.png/);
    await expect(page.locator(".how-to-art")).not.toHaveAttribute("src", /_next\/image/);
  });

  test("contains the bleed how-to image in tall desktop browsers", async ({ page }) => {
    await page.setViewportSize({ width: 544, height: 1274 });
    await page.goto("/");

    await page.getByRole("button", { name: "How to Play" }).click();
    await page.getByRole("button", { name: "Next", exact: true }).click();
    await expect(page.locator(".how-to-art")).toBeVisible();

    await expect(page.locator(".how-to-illustration-frame.bleed .how-to-art")).toHaveCSS("object-fit", "contain");
  });
});
