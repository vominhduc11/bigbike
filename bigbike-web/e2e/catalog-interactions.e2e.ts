import { expect, test, type Page } from "@playwright/test";

async function openCatalog(page: Page) {
  await page.goto("/sp/", { waitUntil: "domcontentloaded" });
  await page.locator("[data-product-card]").first().waitFor({ state: "visible" });
}

test.describe("Catalog layout @desktop", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test("hiển thị sidebar, sort và lưới bốn cột", async ({ page }) => {
    await openCatalog(page);
    const hero = page.locator("[data-page-hero]");
    await expect(hero).toBeVisible();
    expect(Math.round((await hero.boundingBox())?.height ?? 0)).toBe(450);
    await expect(hero.locator("img").last()).toBeVisible();
    await expect(page.getByRole("complementary")).toBeVisible();
    await expect(page.getByRole("combobox")).toBeVisible();

    const cards = page.locator("[data-product-card]");
    expect(await cards.count()).toBeGreaterThanOrEqual(4);
    const firstRows = await Promise.all(
      [0, 1, 2, 3].map((index) => cards.nth(index).boundingBox()),
    );
    expect(new Set(firstRows.map((box) => Math.round(box?.y ?? -1))).size).toBe(1);
  });
});

test.describe("Catalog filters @mobile", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("hiển thị lưới hai cột và đóng mở bộ lọc", async ({ page }) => {
    await openCatalog(page);
    const hero = page.locator("[data-page-hero]");
    expect(Math.round((await hero.boundingBox())?.height ?? 0)).toBe(250);
    await expect(hero.locator("img").last()).toBeHidden();
    const cards = page.locator("[data-product-card]");
    const first = await cards.nth(0).boundingBox();
    const second = await cards.nth(1).boundingBox();
    expect(Math.round(first?.y ?? -1)).toBe(Math.round(second?.y ?? -2));

    await page.getByRole("button", { name: /bộ lọc/i }).click();
    const dialog = page.getByRole("dialog", { name: /bộ lọc/i });
    await expect(dialog).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
  });
});
